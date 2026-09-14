/**
 * Order Service
 * Core order management - creation, updates, payment processing
 * 
 * Dependencies: Utils.gs, Config.gs, SettingsService, NotificationService, 
 *               DriverService, PricingService, CustomerService
 */
const OrderService = {
  create: (payload, settings) => {
    Utils.log("DEBUG", "OrderService.create: Entry", { orderId: payload.orderId });
    
    // 1. Validation
    const validation = OrderService._validateCreatePayload(payload);
    if (!validation.ok) return validation.error;

    const lock = LockService.getScriptLock();
    let orderId = null;
    let postCreateArgs = null;
    try {
      // [FIX C-01] Use tryLock instead of waitLock so the caller gets a clear 503
      // instead of a generic "שגיאה ביצירת ההזמנה" when the system is busy.
      if (!lock.tryLock(CONSTANTS.LOCK_SHORT)) {
        Utils.log("WARN", "OrderService.create: Could not acquire lock", {});
        return Utils.error('המערכת עמוסה כרגע, נסה שוב בעוד שניות ספורות', 503);
      }

      // 2. Pricing & Date Processing
      const { pickupDate, priceVal, pricingRes } = OrderService._resolveOrderDetails(payload, settings);
      if (!pickupDate) return Utils.error('מועד איסוף לא תקין');

      // 3. Idempotency & Duplicate Check
      const idempotencyKey = OrderService._generateIdempotencyKey(payload, priceVal);
      const duplicate = OrderService._checkDuplicate(idempotencyKey);
      if (duplicate) return duplicate;

      // 4. Atomic ID Generation & Row Save
      const saved = OrderService._saveOrderRow(payload, pickupDate, priceVal, pricingRes, idempotencyKey);
      if (!saved.orderId) return Utils.error('שגיאה בשמירת ההזמנה');

      orderId = saved.orderId;
      // [FIX C-04] Capture args INSIDE lock, then release BEFORE dispatching notifications.
      // This prevents HTTP calls to WhatsApp/Telegram from blocking the sheet lock.
      postCreateArgs = { orderId, payload, pickupDate, priceVal, pricingRes, settings };

    } catch (e) {
      Utils.log("ERROR", "Order Creation Failed", { error: e.toString(), stack: e.stack });
      return Utils.error('שגיאה ביצירת ההזמנה: ' + e.toString());
    } finally {
      try { lock.releaseLock(); } catch (e) { Utils.log("DEBUG", "Lock Release (create)", e.toString()); }
    }

    // [FIX C-04] Notifications run OUTSIDE the lock — HTTP calls cannot block other order operations
    if (postCreateArgs) {
      try {
        OrderService._executePostCreateActions(
          postCreateArgs.orderId, postCreateArgs.payload,
          postCreateArgs.pickupDate, postCreateArgs.priceVal,
          postCreateArgs.pricingRes, postCreateArgs.settings
        );
      } catch (e) {
        Utils.log("ERROR", "Post-Create Actions Failed (order saved OK)", { orderId, error: e.toString() });
      }
    }

    return Utils.json({ ok: true, data: { orderId } });
  },

  // --- PRIVATE HELPERS ---

  _validateCreatePayload: (payload) => {
    const validation = ValidationService.validate(payload, 'order');
    if (!validation.valid) return { ok: false, error: Utils.json({ ok: false, error: 'Validation failed', errors: validation.errors, code: 400 }) };

    const presence = Utils.validatePayload(payload, ['pickup_address', 'destination_address', 'price']);
    if (!presence.ok) return { ok: false, error: Utils.error(`חסר מידע חיוני: ${presence.missing.join(', ')}`) };

    return { ok: true };
  },

  _resolveOrderDetails: (payload, settings) => {
    // Date Parsing
    const pickupDateArr = (payload.pickup_date || payload.pickupDate || "").split(/[/-]/);
    const pickupTimeArr = (payload.pickup_time || payload.pickupTime || "").split(':');
    let pickupDate = null;
    if (pickupDateArr.length === 3 && pickupTimeArr.length >= 2) {
        const [p1, p2, p3] = pickupDateArr.map(Number);
        const [h, m] = pickupTimeArr.map(Number);
        pickupDate = p1 > 1900 ? new Date(p1, p2 - 1, p3, h, m) : new Date(p3, p2 - 1, p1, h, m);
    }

    let priceVal = Utils.parsePrice(payload.price);
    let pricingRes = null;

    if ((!priceVal || priceVal <= 0) && (payload.pickup_address || payload.pickupAddress)) {
        try {
            pricingRes = PricingService.calculate({
                pickupAddress: payload.pickup_address || payload.pickupAddress,
                destinationAddress: payload.destination_address || payload.destinationAddress,
                pickupLat: payload.pickup_lat,
                pickupLng: payload.pickup_lng
            }, settings);
            if (pricingRes?.ok && pricingRes.data?.price > 0) priceVal = pricingRes.data.price;
        } catch (e) { Utils.log("WARN", "Auto-Price Calc Failed", e.toString()); }
    }

    return { pickupDate, priceVal, pricingRes };
  },

  _generateIdempotencyKey: (payload, price) => {
    const str = `${payload.customer_phone || payload.customerPhone}_${payload.pickup_address || payload.pickupAddress}_${price}_${payload.pickup_date || payload.pickupDate || ""}`;
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str)
      .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
  },

  _checkDuplicate: (key) => {
    try {
      const ordersByIdemp = Utils.getDataMap('Orders', 'idempotency_key');
      const recent = ordersByIdemp.get(key);
      // Reduce duplicate block window to 10 minutes (was 24 hours which blocked identical test orders)
      if (recent && (Date.now() - Utils.parseDate(recent.created_at).getTime() < 10 * 60 * 1000)) {
        Utils.log("WARN", "Order blocked by duplicate check", { idempotencyKey: key, oldOrderId: recent.order_id });
        // Return ok: false so frontend correctly displays "Duplicate Order" instead of "Success!"
        return Utils.json({ ok: false, error: 'הזמנה כפולה: הזמנה זהה כבר התקבלה במערכת בדקות האחרונות.' });
      }
    } catch (e) {
      Utils.log("WARN", "Duplicate check failed", e.toString());
    }
    return null;
  },

  _saveOrderRow: (payload, pickupDate, price, pricingRes, idempotencyKey) => {
    const sheet = Utils.getSS().getSheetByName('Orders');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
    const scriptProps = PropertiesService.getScriptProperties();
    const lastId = parseInt(scriptProps.getProperty('LAST_ORDER_ID')) || 1000;
    const newId = lastId + 1;
    const orderId = `TAXI-${newId}`;

    const dataMap = {
      'order_id': orderId,
      'customer_name': Utils.sanitize(payload.customer_name || payload.customerName),
      'customer_phone': Utils.formatPhoneForSheet(payload.customer_phone || payload.customerPhone),
      'pickup_address': Utils.sanitize(payload.pickup_address || payload.pickupAddress),
      'pickup_exact_address': Utils.sanitize(payload.pickup_exact_address || payload.pickupExactAddress || ''),
      'pickup_notes': Utils.sanitize(payload.pickup_notes || payload.pickupNotes || ''),
      'destination_address': Utils.sanitize(payload.destination_address || payload.destinationAddress),
      'destination_exact_address': Utils.sanitize(payload.destination_exact_address || payload.destinationExactAddress || ''),
      'destination_notes': Utils.sanitize(payload.destination_notes || payload.destinationNotes || ''),
      'pickup_datetime': Utils.formatDateTime(pickupDate),
      'price': price,
      'status': OrderStatus.PENDING,
      'idempotency_key': idempotencyKey,
      'created_at': Utils.now(),
      'updated_at': Utils.now(),
      'distance_km': pricingRes?.data?.distanceKm || '',
      'duration': pricingRes?.data?.duration || '',
      'passengers': String(payload.passengers || '1'),
      'luggage': String(payload.luggage || '0'),
      'flight_number': Utils.sanitize(payload.flight_number || payload.flightNumber || ''),
      'payment_method': String(payload.payment_method || payload.paymentMethod || 'cash'),
      'pickup_lat': payload.pickup_lat || payload.pickupLat || '',
      'pickup_lng': payload.pickup_lng || payload.pickupLng || '',
      'destination_lat': payload.destination_lat || payload.destinationLat || payload.destLat || '',
      'destination_lng': payload.destination_lng || payload.destinationLng || payload.destLng || ''
    };

    const row = headers.map(h => dataMap[Utils.getCanonicalMap()[h] || h] || '');
    if (Utils.appendRowWithRetry(sheet, row)) {
      scriptProps.setProperty('LAST_ORDER_ID', String(newId));
      SettingsService.save({ 'LAST_ORDER_ID': newId });
      return { orderId, row };
    }
    Utils.log("ERROR", "Order Row Save Failed", { orderId: orderId, row: row });
    return {};
  },

  _executePostCreateActions: (orderId, payload, pickupDate, price, pricingRes, settings) => {
    const notificationOrder = {
       order_id: orderId,
       customer_name: payload.customer_name || payload.customerName,
       customer_phone: Utils.normalizePhone(payload.customer_phone || payload.customerPhone),
       pickup_address: payload.pickup_address || payload.pickupAddress,
       pickup_exact_address: payload.pickup_exact_address || payload.pickupExactAddress || '',
       pickup_notes: payload.pickup_notes || payload.pickupNotes || '',
       destination_address: payload.destination_address || payload.destinationAddress,
       destination_exact_address: payload.destination_exact_address || payload.destinationExactAddress || '',
       destination_notes: payload.destination_notes || payload.destinationNotes || '',
       pickup_datetime: pickupDate,
       price: price,
       notes: payload.notes || '',
       passengers: String(payload.passengers || '1'),
       luggage: String(payload.luggage || '0'),
       flight_number: payload.flight_number || payload.flightNumber || '',
       payment_method: payload.payment_method || payload.paymentMethod || 'cash',
       pickup_lat: payload.pickup_lat || payload.pickupLat,
       pickup_lng: payload.pickup_lng || payload.pickupLng,
       destination_lat: payload.destination_lat || payload.destinationLat || payload.destLat,
       destination_lng: payload.destination_lng || payload.destinationLng || payload.destLng
    };

    // 1. Send Notifications
    const notificationRes = NotificationService.sendNewOrder(notificationOrder, settings, payload.notificationChannels);

    // 2. Transition to BROADCASTED
    const broadcastIds = {};
    let whatsappMsgId = '';
    let isSuccess = false;
    let errors = [];

    if (notificationRes) {
      if (notificationRes.whatsapp) {
          if (notificationRes.whatsapp.ok) {
              whatsappMsgId = notificationRes.whatsapp.bridgeMessageId || 'sent';
              broadcastIds.whatsapp = whatsappMsgId;
              isSuccess = true;
          } else {
              errors.push(`WhatsApp: ${notificationRes.whatsapp.error || 'Failed'}`);
          }
      }
      
      if (notificationRes.telegram) {
          if (notificationRes.telegram.ok && notificationRes.telegram.messageId) {
              broadcastIds.telegram = notificationRes.telegram.messageId;
              isSuccess = true;
          } else if (!notificationRes.telegram.ok) {
              errors.push(`Telegram: ${notificationRes.telegram.error || 'Failed'}`);
          }
      }
    }

    if (!isSuccess && (notificationRes?.whatsapp || notificationRes?.telegram)) {
        throw new Error("Broadcast Failed: " + errors.join(' | '));
    }

    OrderService.update({ orderId, updates: { status: OrderStatus.BROADCASTED, broadcast_msg_id: JSON.stringify(broadcastIds), whatsapp_msg_id: whatsappMsgId }, skipFirebase: true, skipAuth: true }, settings);

    // 3. Stats & CRM
    DashboardService.updateStatsIncremental({ ordersToday: 1, pendingCount: 1, pending: price });
    CustomerService.updateProfile({ ...payload, price, customerPhone: notificationOrder.customer_phone });

    // 4. Firebase Sync
    if (Firebase.isEnabled()) {
      Firebase.set(Utils.getFirebaseOrderPath(orderId), {
        ...Utils.toSnakeCase(notificationOrder),
        status: OrderStatus.BROADCASTED,
        timestamp: Date.now()
      });
    }
  },

  getOrderDetails: (payload, settings) => {
    const { order_id, orderId, phone } = payload;
    const lookupId = order_id || orderId;
    let order = null;

    // [OPTIMIZATION REMOVED] Sheets-First enforced for stability
    // try { const fbOrder = Firebase.get(...) } catch ...

    // Fallback: Use LiteData for ultra-fast lookup from Sheets
    const liteOrders = Utils.getLiteData('Orders', Schema.Columns.Orders);
    const orderIdx = liteOrders.findIndex(o => Utils.compareIds(o.order_id, lookupId));
    
    if (orderIdx === -1) return Utils.error('Order not found', 404);
    order = liteOrders[orderIdx];
    const rowIndex = orderIdx + 2;

    // Robust Driver Phone Lookup
    let driverPhone = Utils.normalizePhone(order.driver_phone || order.driverphone);
    const driverId = order.driver_id || order.driverid;

    // Fetch Driver Details (for Car Info & Phone Fallback)
    let driverObj = null;
    if (driverId) {
        const driversMap = Utils.getDataMap('Drivers', 'driver_id');
        driverObj = driversMap.get(String(driverId).trim());
        if (driverObj && !driverPhone) {
             driverPhone = Utils.normalizePhone(driverObj.phone);
        }
    }

    const inputPhone = Utils.normalizePhone(phone);
    
    let isAuthorized = false;
    // 1. Check Auth Token (Highest Priority for WebApp)
    const token = payload.authToken || (payload.request && payload.request.authToken);
    if (token && Utils.checkAuth(token, 'admin', settings)) {
        isAuthorized = true;
    } else if (token && Utils.checkAuth(token, 'driver', settings)) {
        // Valid driver token - does it match this order?
        const driverIdFromToken = String(token).split('_')[1];
        if (Utils.compareIds(driverIdFromToken, driverId)) {
            isAuthorized = true;
        }
    }

    // 2. Legacy Phone Check (e.g. from WhatsApp Redirect URL)
    if (!isAuthorized && driverPhone && inputPhone && driverPhone === inputPhone) {
        // ADDITIONAL SECURITY: Verify the phone belongs to an ACTIVE driver in our DB
        const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
        const driver = driversMap.get(inputPhone);
        if (driver && driver.status === DriverStatus.ACTIVE) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        Utils.log("WARN", "Unauthorized getOrderDetails Attempt", { orderId: lookupId, phoneEntered: inputPhone, assignedPhone: driverPhone, assignedId: driverId, hasToken: !!token });
        return Utils.error('Unauthorized - Access Denied', 403);
    }

    const isPaid = String(order.payment_completed || order.paymentcompleted || '').toLowerCase() === 'true';
    const commPct = (settings['STATION_COMMISSION_PCT'] !== undefined) ? parseFloat(settings['STATION_COMMISSION_PCT']) : 15;
    const commission = (Utils.parsePrice(order.price) * (commPct / 100)).toFixed(2);

    return Utils.json({
        ok: true,
        data: {
            order_id: order.order_id,
            driver_id: order.driver_id ||  order.driverid,
            status: order.status,
            price: order.price,
            commission: commission,
            pickup_datetime: order.pickup_datetime,
            pickup_address: order.pickup_address,
            destination_address: order.destination_address,
            payment_completed: isPaid,
            customer_name: isPaid ? order.customer_name : 'הושלם תשלום לחשיפה',
            customer_phone: isPaid ? (order.customer_phone || order.customerPhone) : null,
            pickup_notes: isPaid ? order.pickup_notes : null,
            destination_notes: isPaid ? order.destination_notes : null,
            pickup_exact_address: isPaid ? order.pickup_exact_address : null,
            destination_exact_address: isPaid ? order.destination_exact_address : null,
            updated_at: order.updated_at || order.updatedat || order.created_at || order.createdat,
            server_time: new Date().getTime(),
            google_maps_api_key: settings['GOOGLE_MAPS_API_KEY'] || '',
            payment_phone: settings['STATION_PAYMENT_PHONE'] || '',
            paypal_email: settings['STATION_PAYPAL_EMAIL'] || '',
            distanceKm: order.distance_km || order.distancekm,
            duration: order.duration,
            pickupLat: order.pickup_lat || order.pickuplat,
            pickupLng: order.pickup_lng || order.pickuplng,
            destinationLat: order.destination_lat || order.destinationlat,
            destinationLng: order.destination_lng || order.destinationlng,
            passengers: order.passengers,
            luggage: order.luggage,
            flight_number: order.flight_number || order.flightnumber,
            payment_method: order.payment_method || order.paymentmethod,
            driver: driverObj ? {
                name: driverObj.driver_name,
                phone: driverObj.phone,
                carModel: driverObj.car_model || driverObj.carmodel,
                carColor: driverObj.car_color || driverObj.carcolor,
                plateNumber: driverObj.taxi_plate_number || driverObj.taxiplatenumber
            } : null
        }
    });
  },

  getOfferDetails: (payload, settings) => {
      // Public/Semi-public endpoint for drivers to view offer before accepting
      const { orderId, phone } = payload;
      
      // [SECURITY FIX] Add phone validation or basic rate limit check
      if (!phone) return Utils.error('Phone required for offer details', 401);

      // Verify phone belongs to a registered driver (Basic Auth)
      const normalizedPhone = Utils.normalizePhone(phone);
      // transformKey optimization: Check if phone exists in Drivers map
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
      if (!driversMap.has(normalizedPhone)) {
          return Utils.error('Unauthorized: Driver not registered', 403);
      }

      const ordersMap = Utils.getDataMap(Schema.Sheets.ORDERS, 'order_id');
      const order = ordersMap.get(orderId);
      
      if (!order) return Utils.error('Order not found', 404);
      
      // Mask Sensitive Info? Maybe not necessary for Offer, but good practice.
      // We send coordinates for the Map.
      return Utils.json({
          ok: true,
          data: {
             orderId: order.order_id,
             price: order.price,
             pickup_address: order.pickup_address,
             destination_address: order.destination_address,
             pickupLat: order.pickup_lat || order.pickuplat,
             pickupLng: order.pickup_lng || order.pickuplng,
             destLat: order.dest_lat || order.destlat,
             destLng: order.dest_lng || order.destlng,
             google_maps_api_key: settings['GOOGLE_MAPS_API_KEY'] || '',
             passengers: order.passengers,
             luggage: order.luggage,
             payment_method: order.payment_method || order.paymentmethod
          }
      });
  },

  getPaymentInfo: (payload, settings) => {
    const oid = payload.orderId || payload.order_id;
    if (!oid) return Utils.error('Invalid Order ID');

    const ordersMap = Utils.getDataMap('Orders', 'order_id');
    let order = ordersMap.get(String(oid).trim());
    
    // [FIX] Robust Lookup for Payment
    if (!order && !String(oid).includes('-')) {
        order = ordersMap.get(`TAXI-${oid}`);
    }

    if (!order) {
        Utils.log("ERROR", "Order not found", { requestOrderId: oid });
        return Utils.error('הזמנה לא נמצאה', 404);
    }
    
    // Check Status for fail-fast
    const isPaid = String(order.payment_completed || '').toLowerCase() === 'true';

    const fullPrice = parseFloat(String(order.price || "0").replace(/[₪,]/g, '').trim()) || 0;
    const commPct = (settings['STATION_COMMISSION_PCT'] !== undefined) ? parseFloat(settings['STATION_COMMISSION_PCT']) : 15;
    const commission = Math.round(fullPrice * (commPct / 100));
    
    // [FIX] Return CamelCase for React Frontend
    return Utils.json({
      ok: true,
      data: {
        price: fullPrice,
        commission: commission,
        paymentPhone: settings['STATION_PAYMENT_PHONE'],
        paypalEmail: settings['STATION_PAYPAL_EMAIL'],
        orderId: order.order_id,
        status: order.status,
        paymentCompleted: isPaid,
        createdAt: order.created_at,
        serverTime: Date.now()
      }
    });
  },

  /**
   * Increment total_rides for a driver
   */
  incrementRides: (driverId) => {
      // Use direct sheet access for write consistency
      const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(Utils.normalizeHeader);
      const idIdx = headers.indexOf('driverid');
      const ridesIdx = headers.indexOf('totalrides');
      
      if (idIdx === -1 || ridesIdx === -1) return false;
      
      const rowIndex = data.findIndex(row => Utils.compareIds(row[idIdx], driverId)) + 1;
      if (rowIndex <= 1) return false;
      
      const current = parseInt(data[rowIndex-1][ridesIdx]) || 0;
      sheet.getRange(rowIndex, ridesIdx + 1).setValue(current + 1);
      
      // Clear Cache
      try { CacheService.getScriptCache().remove('data_Drivers_0'); } catch(e){}
      if (Utils._memCache) Utils._memCache['Drivers'] = null;
      
      return true;
  },

  getAll: (payload) => {
    const page = parseInt(payload.page) || 1;
    const pageSize = parseInt(payload.pageSize) || 20;
    
    // OPTIMIZATION: If page 1, strictly fetch only needed rows + buffer (e.g. 50) from Sheets
    // This avoids reading 1000s of rows for the default view.
    const limit = page === 1 ? Math.max(pageSize, 50) : 0; 
    const data = Utils.getData('Orders', false, limit);
    
    // Sorting by created_at desc (efficient)
    const sorted = data.sort((a, b) => {
        const tA = Utils.parseDate(a.created_at)?.getTime() || 0;
        const tB = Utils.parseDate(b.created_at)?.getTime() || 0;
        return tB - tA;
    });
    
    const statusFilter = String(payload.status || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const filtered = statusFilter.length
      ? sorted.filter(o => statusFilter.includes(String(o.status || '').toLowerCase()))
      : sorted;

    const startIdx = (page - 1) * pageSize;
    const paginated = filtered.slice(startIdx, startIdx + pageSize);
    
    return Utils.json({ 
      ok: true, 
      data: { 
        items: paginated, 
        total: filtered.length,
        timestamp: Utils.now()
      } 
    });
  },

  /**
   * Alias for getStatus - used by ActionHandlers and Dashboard
   */
  getOne: (orderId) => OrderService.getStatus(orderId),

  getStatus: (orderId) => {
    if (!orderId) return Utils.error('Invalid ID');
    const lookupId = String(orderId).trim();
    
    // Audit Fix #20: Use Map for O(1) lookup instead of find()
    const ordersMap = Utils.getDataMap(Schema.Sheets.ORDERS, 'order_id');
    const order = ordersMap.get(lookupId);
    
    // [COMPAT] Try without DASH if first lookup falls
    if (!order && !lookupId.includes('-')) {
        const withDash = ordersMap.get(`TAXI-${lookupId}`);
        if (withDash) return OrderService.getStatus(`TAXI-${lookupId}`);
    }

    if (!order) {
        Utils.log("ERROR", "Order search failed", { lookupId, keysInMap: Array.from(ordersMap.keys()).slice(0, 10) });
        return Utils.error('הזמנה לא נמצאה', 404);
    }

    if (order.driver_id) {
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id');
      const driver = driversMap.get(order.driver_id);
      if (driver) {
        order.driverPhone = driver.phone;
        order.driverCarPlate = driver.taxi_plate_number;
      }
    }
    
    // COMPAT: Ensure updated_at exists (frontend expects it with underscore)
    if (!order.updated_at && order.updatedat) {
        order.updated_at = order.updatedat;
    }

    return Utils.json({ ok: true, data: order });
  },

  update: (payload, settings) => {
    // [FIX] BUG #2: Accept settings from ActionHandler to enable admin auth checks
    if (!settings) settings = SettingsService.getMap();
    const sheet = Utils.getSS().getSheetByName(Schema.Sheets.ORDERS);
    payload.orderId = payload.orderId || payload.order_id; // Normalize key
    
    // [FIX] Robust ID Lookup (Standardized) for Edit/Update
    // Instead of textFinder(exact), we iterate to find the ID even if formatted differently
    const data = sheet.getDataRange().getValues();
    const headersRaw = data[0];
    const canonicalMap = Utils.getCanonicalMap();
    const headers = headersRaw.map(h => {
        const norm = Utils.normalizeHeader(h);
        return canonicalMap[norm] || norm;
    });

    const idColIdx = headers.indexOf('order_id');
    if (idColIdx === -1) return Utils.error('System Data Error: Missing order_id');

    let rowIndex = -1;
    // Iterate to find
    for (let i = 1; i < data.length; i++) {
        if (Utils.compareIds(data[i][idColIdx], payload.orderId || payload.order_id)) {
            rowIndex = i + 1;
            break;
        }
    }
    
    if (rowIndex === -1) {
        Utils.log("ERROR", "Update Failed: Order Not Found", { id: payload.orderId });
        return Utils.error('הזמנה לא נמצאה', 404);
    }

    const orderRow = Utils.getRowMap(sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0], headers);
    const orderData = {
        order_id: orderRow.order_id,
        driver_id: orderRow.driver_id,
        driver_phone: orderRow.driver_phone,
        status: orderRow.status
    };

    // [FIX] BUG #1: Read currentStatus BEFORE the auth check where it's logged
    const statusIdx = headers.indexOf('status');
    const currentStatus = sheet.getRange(rowIndex, statusIdx + 1).getValue();

    // [AUTH] Security Check - Skip if internal system call with skipAuth flag
    let isAuthorized = false;
    const adminToken = payload.authToken || (payload.request && payload.request.authToken);

    if (payload.skipAuth) {
        isAuthorized = true; // Internal system calls can bypass auth
    } else {
        // 1. Check Admin Auth
        if (adminToken && Utils.checkAuth(adminToken, 'admin', settings)) {
            isAuthorized = true;
        } else if (adminToken && Utils.checkAuth(adminToken, 'driver', settings)) {
            // Driver Token Check
            const driverIdFromToken = String(adminToken).split('_')[1];
            if (Utils.compareIds(driverIdFromToken, orderRow.driver_id)) {
                isAuthorized = true;
            }
        }

        // 2. Phone-based Check (from App URL)
        if (!isAuthorized && (payload.phone || payload.driverPhone)) {
            let inputPhone = String(payload.phone || payload.driverPhone || '').trim();
            // Defensive check for common frontend-to-backend "null" strings
            if (inputPhone === 'null' || inputPhone === 'undefined' || inputPhone === 'NONE') {
                inputPhone = '';
            }
            
            if (inputPhone) {
                const normalizedInput = Utils.normalizePhone(inputPhone);
                const storedDriverPhone = Utils.normalizePhone(orderRow.driver_phone || orderRow.driverphone || '');
                
                if (storedDriverPhone && storedDriverPhone === normalizedInput) {
                    isAuthorized = true;
                } else if (orderRow.driver_id) {
                    // Check via driver_id if phone on order row is empty/stale
                    const driversMap = Utils.getDataMap('Drivers', 'driver_id');
                    const driver = driversMap.get(orderRow.driver_id);
                    if (driver && Utils.normalizePhone(driver.phone) === normalizedInput) {
                        isAuthorized = true;
                    }
                }
            }
        }
    }

    if (!isAuthorized) {
        Utils.log("WARN", "Unauthorized Update Attempt", { 
            orderId: payload.orderId, 
            phone: payload.phone || 'NONE',
            hasToken: !!adminToken,
            currentStatus: currentStatus,
            storedDriverPhone: orderRow.driver_phone
        });
        return Utils.error('Unauthorized', 403);
    }

    // RESTRICTION: Non-Admin can ONLY update specific fields
    const sensitiveFields = ['price', 'commission', 'driver_profit', 'customer_phone', 'customer_name'];
    const hasSensitiveUpdates = sensitiveFields.some(f => payload.updates[f] !== undefined);
    const isAdmin = adminToken && Utils.checkAuth(adminToken, 'admin', settings);

    if (hasSensitiveUpdates && !isAdmin) {
        return Utils.error('Unauthorized: Sensitive field update restricted to admin.', 403);
    }
    // [FIX] BUG #1: statusIdx and currentStatus are now declared earlier (before auth check)

    // Guard: State Machine Check
    if (payload.updates.status) {
        if (!StateMachine.canTransition(currentStatus, payload.updates.status)) {
             return Utils.error(`מעבר סטטוס לא חוקי: ${currentStatus} -> ${payload.updates.status}`);
        }
        
        // Auto-Clear Driver on Cancel
        if (payload.updates.status === OrderStatus.CANCELLED) {
            payload.updates.driver_id = '';
            payload.updates.driver_name = '';
            payload.updates.driver_phone = '';
        }

        // Audit Trail
        Utils.log("AUDIT", "OrderStatusChange", { 
            orderId: payload.orderId, 
            from: currentStatus, 
            to: payload.updates.status 
        });

        // [NEW] Track assignment and arrival times for metrics
        const nowTime = Utils.now();
        if ((payload.updates.status === OrderStatus.ASSIGNED || payload.updates.status === OrderStatus.CONFIRMED) && !orderRow.assigned_at) {
             payload.updates.assigned_at = nowTime;
        }
        if (payload.updates.status === OrderStatus.ARRIVED && !orderRow.arrived_at) {
             payload.updates.arrived_at = nowTime;
        }

        // [NEW] Handle Stats & Firebase Sync per Status Transition
        const oldStatusNorm = Utils.normalizeStatus(currentStatus);
        const newStatusNorm = Utils.normalizeStatus(payload.updates.status);

        if (oldStatusNorm !== newStatusNorm) {
            const price = Utils.parsePrice(data[rowIndex-1][headers.indexOf('price')]);
            const statsUpdate = {};
            
            // Re-mapping status for decrement/increment
            const statusKeyMap = {
                [OrderStatus.PENDING]: 'pendingCount',
                [OrderStatus.BROADCASTED]: 'pendingCount', // Treat broadcasted as pending
                [OrderStatus.CONFIRMED]: 'activeCount',
                [OrderStatus.ASSIGNED]: 'activeCount',
                [OrderStatus.ARRIVED]: 'activeCount',
                [OrderStatus.IN_PROGRESS]: 'activeCount',
                [OrderStatus.COMPLETED]: 'completedCount',
                [OrderStatus.CANCELLED]: 'cancelledCount'
            };

            if (statusKeyMap[oldStatusNorm]) statsUpdate[statusKeyMap[oldStatusNorm]] = -1;
            if (statusKeyMap[newStatusNorm]) statsUpdate[statusKeyMap[newStatusNorm]] = 1;

            // Revenue shift
            const revKeyMap = {
                [OrderStatus.PENDING]: 'pending',
                [OrderStatus.BROADCASTED]: 'pending',
                [OrderStatus.CONFIRMED]: 'confirmed',
                [OrderStatus.ASSIGNED]: 'confirmed',
                [OrderStatus.ARRIVED]: 'confirmed',
                [OrderStatus.IN_PROGRESS]: 'confirmed',
                [OrderStatus.COMPLETED]: 'completed',
                [OrderStatus.CANCELLED]: 'cancelled'
            };
            if (revKeyMap[oldStatusNorm]) statsUpdate[revKeyMap[oldStatusNorm]] = -price;
            if (revKeyMap[newStatusNorm]) statsUpdate[revKeyMap[newStatusNorm]] = price;

            // Global revenue only on completion
            if (newStatusNorm === OrderStatus.COMPLETED) {
                statsUpdate.totalRevenue = price;
                const settings = SettingsService.getMap();
                const commPct = (settings['STATION_COMMISSION_PCT'] !== undefined) ? parseFloat(settings['STATION_COMMISSION_PCT']) : 15;
                statsUpdate.stationCommission = price * (commPct / 100);
            }

            DashboardService.updateStatsIncremental(statsUpdate);
        }

        // Firebase Sync - FOR ANY UPDATE (status, notes, coords, etc.)
        if (!payload.skipFirebase) {
            try {
                if (newStatusNorm === OrderStatus.CANCELLED) {
                    Firebase.remove(Utils.getFirebaseOrderPath(payload.orderId));
                } else {
                    // Sync EVERYTHING to Firebase to ensure real-time UI consistency
                    const fbPayload = { 
                        ...Utils.toSnakeCase(payload.updates),
                        updated_at: new Date().toISOString(),
                        order_id: payload.orderId
                    };
                    
                    // [SYNC FIX] Ensure coordinates are included if they're being updated
                    if (payload.updates.pickup_lat || payload.updates.pickupLat) fbPayload.pickup_lat = payload.updates.pickup_lat || payload.updates.pickupLat;
                    if (payload.updates.pickup_lng || payload.updates.pickupLng) fbPayload.pickup_lng = payload.updates.pickup_lng || payload.updates.pickupLng;
                    if (payload.updates.destination_lat || payload.updates.destinationLat) fbPayload.destination_lat = payload.updates.destination_lat || payload.updates.destinationLat;
                    if (payload.updates.destination_lng || payload.updates.destinationLng) fbPayload.destination_lng = payload.updates.destination_lng || payload.updates.destinationLng;

                    Firebase.update(Utils.getFirebaseOrderPath(payload.orderId), fbPayload);
                }
            } catch (e) { Utils.log("WARN", "Firebase Sync Failed", e.toString()); }
        }

        // NOTIFY CUSTOMER ON ARRIVED
        if (payload.updates.status === OrderStatus.ARRIVED && currentStatus !== OrderStatus.ARRIVED) {
             try {
                const dIdIdx = headers.indexOf('driver_id') > -1 ? headers.indexOf('driver_id') : headers.indexOf('driverid');
                // Use rowIndex (calculated earlier) to look up data
                if (rowIndex > 0 && dIdIdx > -1) {
                    const rowData = data[rowIndex - 1];
                    const rowDriverId = rowData[dIdIdx];
                    
                    if (rowDriverId) {
                        const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id');
                        const driverObj = driversMap.get(rowDriverId);
                        
                        if (driverObj) {
                            // Construct order object for notification
                            const orderData = {};
                            headers.forEach((h, i) => orderData[h] = rowData[i]);
                            orderData.order_id = payload.orderId;
                            // Ensure key consistency for notification template - Preserve "customer_phone" fix
                            orderData.customer_phone = orderData.customer_phone || orderData.customerphone || '';
                            orderData.customer_name = orderData.customer_name || orderData.customer_phone || '';
                            
                            NotificationService.sendDriverArrived(orderData, driverObj, SettingsService.getMap());
                        }
                    }
                }
             } catch(e) {
                 Utils.log("WARN", "ArrivedNotificationError", { error: e.toString() });
             }
        }

        // [FIX] BUG #10: Removed duplicate incrementRides from update().
        // Ride counter is already incremented in complete() when order is finalized.
    }
    
    // Use mapped headers for updating too
    Object.keys(payload.updates).forEach(key => {
      const colIdx = headers.indexOf(key);
      if (colIdx > -1) {
        let val = payload.updates[key];
        // If updating phone columns in Orders, ensure display format with leading 0
        if (key === 'customer_phone' || key === 'customerphone' || key === 'driver_phone' || key === 'driverphone') {
          val = Utils.formatPhoneForSheet(payload.updates[key]);
        }
        const cell = sheet.getRange(rowIndex, colIdx + 1);
        cell.setValue(val);
        if (key === 'customer_phone' || key === 'customerphone' || key === 'driver_phone' || key === 'driverphone') {
            try { cell.setNumberFormat('@'); } catch (e) { /* ignore */ }
        }
      }
    });
    
    const updatedIdx = headers.indexOf('updatedat');
    if (updatedIdx > -1) sheet.getRange(rowIndex, updatedIdx + 1).setValue(Utils.now());

    // SpreadsheetApp.flush(); // REMOVED: Performance Optimization
    Utils.clearCache('Orders');
    return Utils.json({ ok: true });
  },

  // === CORE ASSIGNMENT LOGIC (INTERNAL) ===
  assignDriverToOrder: (orderId, driver, settings) => {
    const lock = LockService.getScriptLock();
    try {
      // Concurrency Fix: Wait up to 30s for lock, fail if busy
      const WAIT_MS = 30000; 
      if (!lock.tryLock(WAIT_MS)) return Utils.error('System Busy - try again');
      
      // [SECURITY] Ensure we have the absolute latest data after locking
      SpreadsheetApp.flush(); 
      
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName(Schema.Sheets.ORDERS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(Utils.normalizeHeader);
      const idIdx = headers.indexOf('order_id');
      const statusIdx = headers.indexOf('status');
      
      if (idIdx === -1 || statusIdx === -1) return Utils.error('System Data Error');

      let rowIndex = -1;
      let currentStatus = '';

      for (let i = 1; i < data.length; i++) {
        if (Utils.compareIds(data[i][idIdx], orderId)) {
          rowIndex = i + 1;
          currentStatus = String(data[i][statusIdx] || '').toLowerCase(); // Normalize
          break;
        }
      }
    
      if (rowIndex === -1) return Utils.error('ORDER_NOT_FOUND', 404);
      
      // [ATOMIC CHECK] Final verification of status from a fresh cell read
      // This protects against any potential caching issues with getValues()
      const atomicStatus = String(sheet.getRange(rowIndex, statusIdx + 1).getValue() || '').toLowerCase();
      if (atomicStatus !== currentStatus) {
           Utils.log("WARN", "Race condition detected - atomic status differs from range status", { orderId, range: currentStatus, atomic: atomicStatus });
           currentStatus = atomicStatus;
      }

      // CRITICAL GUARD: Check if already taken
      const normStatus = Utils.normalizeStatus(currentStatus);
      const driverIdIdx = headers.indexOf('driverid');
      const currentDriverId = (driverIdIdx > -1) ? data[rowIndex-1][driverIdIdx] : '';
      
      const allowedStatuses = [OrderStatus.PENDING, OrderStatus.BROADCASTED];
      
      if (!allowedStatuses.includes(normStatus)) {
           // Idempotency: If already assigned to ME, return success
           if (Utils.compareIds(currentDriverId, driver.driver_id)) {
               return Utils.json({ ok: true, driverPhone: driver.phone, message: 'Already assigned to you' });
           }

          const driverNameIdx = headers.indexOf('drivername');
          const takenBy = (driverNameIdx > -1 && data[rowIndex-1][driverNameIdx]) ? data[rowIndex-1][driverNameIdx] : 'Someone';
          
          // [FIX ISSUE #4] Better error messages based on actual status
          let errorMessage = `סטטוס לא מאפשר קבלה: ${normStatus}`;
          
          if (normStatus === OrderStatus.WAITING_APPROVAL || normStatus === OrderStatus.ASSIGNED || normStatus === OrderStatus.CONFIRMED) {
               errorMessage = `🚖 הנסיעה כבר תפוסה על ידי ${takenBy}`;
          } else if (normStatus === OrderStatus.PAID || normStatus === OrderStatus.WAITING_APPROVAL) {
               errorMessage = `💳 תשלום נדרש לפני קבלת הנסיעה`;
          } else if (normStatus === OrderStatus.COMPLETED) {
               errorMessage = `✅ הנסיעה כבר הושלמה`;
          } else if (normStatus === OrderStatus.CANCELLED) {
               errorMessage = `❌ הנסיעה בוטלה`;
          }
          
          return Utils.error(errorMessage);
      }

      // DIRECT UPDATE (No heavy OrderService.update recursion inside Lock)
        const set = (col, val) => {
          const cIdx = headers.indexOf(col);
          if (cIdx > -1) {
            const cell = sheet.getRange(rowIndex, cIdx + 1);
            cell.setValue(val);
            // If this is a phone column, enforce TEXT format
            if (col === 'driverphone' || col === 'driver_phone' || col === 'customerphone' || col === 'customer_phone') {
              try { cell.setNumberFormat('@'); } catch (e) { /* ignore */ }
            }
          }
        };

      set('status', OrderStatus.ASSIGNED);
      set('drivername', driver.driver_name || driver.driverName);
      set('driverid', driver.driver_id || driver.driverId);
      set('driverphone', Utils.formatPhoneForSheet(driver.phone));
      set('updatedat', new Date());
      
      // Force commit before reading back to ensure we get the latest state including any potentially triggered formulas (though we shouldn't rely on them)
      SpreadsheetApp.flush(); // RESTORED: Critical for data integrity to prevent race conditions

      // [SYNC FIX] Ensure Firebase is updated immediately upon assignment
      try {
          if (Firebase.isEnabled()) {
              Firebase.update(Utils.getFirebaseOrderPath(orderId), {
                  status: OrderStatus.ASSIGNED,
                  driver_id: driver.driver_id,
                  driver_name: driver.driver_name,
                  driver_phone: driver.phone,
                  updated_at: new Date().toISOString()
              });
          }
      } catch (e) { Utils.log("WARN", "Firebase Sync Failed in Assign", e.toString()); }

      // Capture state for post-lock actions
      const freshRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      const freshOrderData = {};
      headers.forEach((h, i) => freshOrderData[h] = freshRow[i]);
      
      const mappedOrder = {
           order_id: freshOrderData['orderid'],
           customer_name: freshOrderData['customername'],
           customer_phone: freshOrderData['customerphone'],
           pickup_address: freshOrderData['pickupaddress'],
           destination_address: freshOrderData['destinationaddress'],
           price: freshOrderData['price'],
           pickup_notes: freshOrderData['pickupnotes'],
           destination_notes: freshOrderData['destinationnotes'],
           pickup_datetime: freshOrderData['pickupdatetime'],
           pickup_exact_address: freshOrderData['pickupexactaddress'] || '',
           destination_exact_address: freshOrderData['destinationexactaddress'] || '',
           broadcast_msg_id: freshOrderData['broadcastmsgid'] || freshOrderData['broadcast_msg_id']
      };
      
      let freshDriver = driver;
      try {
        const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id', { transformKey: k => String(k || '').trim() });
        const ref = driversMap.get(String(driver.driver_id || '').trim());
        if (ref) freshDriver = ref;
      } catch (e) { /* use passed driver */ }

      // [FIX C-04] RELEASE LOCK BEFORE EXTERNAL CALLS
      try { lock.releaseLock(); } catch (e) { /* ignore */ }

      // --- POST-LOCK EXTERNAL CALLS (NON-BLOCKING) ---
      try {
          // 1. Notify Driver (Private)
          const assignRes = NotificationService._sendWithRetry(
              'sendDriverAssignment',
              () => NotificationService.sendDriverAssignment(freshDriver, mappedOrder, settings),
              3,
              400
          );
          
          if (!assignRes.ok) {
              Utils.log("ERROR", "Driver Assignment Notification Failed - REVERTING ORDER", { orderId, error: assignRes.error });
              
              // REVERT (Requires NEW LOCK)
              const revertLock = LockService.getScriptLock();
              try {
                  if (revertLock.tryLock(10000)) {
                      set('status', OrderStatus.PENDING);
                      set('drivername', '');
                      set('driverid', '');
                      set('driverphone', '');
                      SpreadsheetApp.flush();
                      
                      if (Firebase.isEnabled()) {
                          Firebase.update(Utils.getFirebaseOrderPath(orderId), {
                              status: OrderStatus.PENDING,
                              driver_id: null,
                              driver_name: null,
                              driver_phone: null,
                              updated_at: new Date().toISOString()
                          });
                      }
                      Utils.clearCache('Orders');
                  }
              } catch (revertErr) {
                  Utils.log("ERROR", "Revert Failed", revertErr.toString());
              } finally {
                  try { revertLock.releaseLock(); } catch (e) { /* ignore */ }
              }
              
              return Utils.error(`שגיאת תקשורת: הנהג לא קיבל את פרטי הנסיעה. ההזמנה הוחזרה למצב המתנה.`);
          }
          
          // 2. Secondary Notifications
          try { NotificationService.sendOrderTakenInGroup(freshDriver, mappedOrder, settings); } catch (e) {}
          try { NotificationService.sendToCustomer(mappedOrder, freshDriver, settings); } catch (e) {}

          Utils.log("AUDIT", "DriverAssignedToOrder", { action: 'DriverAssignedToOrder', orderId, driverId: driver.driver_id });
          return Utils.json({ ok: true, driverPhone: driver.phone, notificationStatus: 'ok' });

      } catch (e) {
          Utils.log("ERROR", "Notification Logic Failed", e.toString());
          return Utils.error('שגיאה בשליחת הודעה לנהג: ' + e.toString());
      }

    } catch (e) {
        Utils.log("ERROR", "AssignDriver Critical Fail", { error: e.toString() });
        return Utils.error(e.toString());
    } finally {
      lock.releaseLock();
    }
  },

  unassignDriver: (orderId, settings) => {
    // ISSUE-001 FIX: Require Admin auth for unassigning drivers
    if (!settings) settings = SettingsService.getMap();
    const adminToken = (settings._authToken) || '';
    if (adminToken && !Utils.checkAuth(adminToken, 'admin', settings)) {
      return Utils.error('Unauthorized: Only admin can unassign a driver', 403);
    }
    // SpreadsheetApp.flush(); // REMOVED: Performance Optimization
    const ordersMap = Utils.getDataMap(Schema.Sheets.ORDERS, 'order_id');
    const order = ordersMap.get(orderId);

    if (!order) return Utils.error('הזמנה לא נמצאה', 404);

    // 1. Update Order: Reset status to PENDING, remove driver info
    OrderService.update({
        orderId,
        updates: {
            status: OrderStatus.PENDING,
            driver_name: '',
            driver_id: ''
        }
    });

    // 2. Notify Groups Again (Re-broadcast)
    // We reconstruct the notification payload
    const notificationOrder = {
        order_id: order.order_id,
        pickup_address: order.pickup_address,
        destination_address: order.destination_address,
        price: order.price,
        pickup_datetime: order.pickup_datetime, // Ensure this format handles strings correctly
        pickup_notes: order.pickup_notes,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone
    };

    NotificationService.sendNewOrder(notificationOrder, settings);
    
    // Notify old driver if they exist
    if (order.driver_id) {
        const driversMap = Utils.getDataMap('Drivers', 'driver_id');
          const oldDriver = driversMap.get(order.driver_id);
          if (oldDriver && oldDriver.telegram_id) {
            NotificationService._broadcast('telegram', 'נסיעה בוטלה', [{ chatId: oldDriver.telegram_id }], settings);
          }
    }
    
    Utils.log("AUDIT", "DriverUnassignedFromOrder", { orderId });
    
    // [HYBRID] Sync Unassign to Firebase
    try {
        Firebase.update(Utils.getFirebaseOrderPath(orderId), {
            status: OrderStatus.PENDING,
            driver_id: null,
            driver_name: null,
            driver_phone: null,
            driver_location: null,
            updated_at: new Date().toISOString()
        });
    } catch (e) { Utils.log("WARN", "Firebase Unassign Sync Failed", e.toString()); }

    return Utils.json({ ok: true });
  },



  resendDetails: (orderId, settings, isRenewed = false) => {
    // Admin Only likely, but we will allow it.
    const ordersMap = Utils.getDataMap('Orders', 'order_id');
    const order = ordersMap.get(orderId);
    if (!order) return Utils.error('Order not found');

    const notificationOrder = {
        order_id: order.order_id,
        pickup_address: order.pickup_address,
        destination_address: order.destination_address,
        price: order.price,
        pickup_datetime: order.pickup_datetime,
        pickup_notes: order.pickup_notes,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        pickup_exact_address: order.pickup_exact_address,
        destination_exact_address: order.destination_exact_address
    };
    
    // Broadcast again (with Renewed prefix if applicable)
    const prefix = isRenewed ? "♻️ *הזמנה מחודשת!*" : "";
    
    // Timer Reset: Update updated_at if renewed
    if (isRenewed) {
        const ss = Utils.getSS();
        const sheet = ss.getSheetByName('Orders');
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(Utils.normalizeHeader);
        const idIdx = headers.indexOf('order_id');
        const updatedIdx = headers.indexOf('updated_at'); // or created_at if simpler, but updated_at is safer
        
        // Find row manually (since we have the map object but not the row index handy, though we could pass it)
        // Optimization: We could use order.row_index if available, but safe lookup is better
        for(let i=1; i<data.length; i++) {
            if(Utils.compareIds(data[i][idIdx], orderId)) {
                if(updatedIdx > -1) sheet.getRange(i+1, updatedIdx+1).setValue(new Date());
                break;
            }
        }
    }

    NotificationService.sendNewOrder(notificationOrder, settings, null, prefix);
    return Utils.json({ ok: true });
  },

  checkPaymentTimeouts: (settings) => {
      // Logic: If status='confirmed', payment not completed, and updated_at > 4 mins ago -> Revert to Pending
      const lock = LockService.getScriptLock();
      try {
          // Short lock just to prevent overlap
          if (!lock.tryLock(5000)) {
              Utils.log("WARN", "checkPaymentTimeouts: Lock busy - skipping this run", {});
              return Utils.json({ ok: false, error: 'Busy' });
          }

          const now = new Date();
          // Optimization: Use LiteData fetch
          const data = Utils.getLiteData('Orders', ['orderid', 'status', 'updatedat', 'paymentcompleted', 'driverphone', 'driverid', 'drivername']);
          
          if (data.length === 0) return Utils.json({ ok: true, count: 0 });
          
          const updates = [];
          
          for (let i = 0; i < data.length; i++) {
              const row = data[i];
              const status = String(row.status || '').toLowerCase();
              
              if (status === 'assigned' || status === 'confirmed') { // BUG-006 FIX: was only 'confirmed'
                  // Check payment
                  const paymentStatus = String(row.paymentcompleted || '');
                  // specific check: if is TRUE (paid) or WAITING_APPROVAL (driver declared), we respect it. 
                  // If EMPTY or FALSE, we check time.
                  if (paymentStatus.toUpperCase() === 'TRUE' || paymentStatus.toUpperCase() === 'WAITING_APPROVAL') continue;
                  
                  const updatedAt = Utils.parseDate(row.updatedat);
                  if (updatedAt) {
                      const diffMins = (now.getTime() - updatedAt.getTime()) / 60000;
                      if (diffMins >= 5) {
                          // TIMEOUT!
                          updates.push({ rowIndex: row._rowIndex, orderId: row.orderid }); // _rowIndex provided by getLiteData
                      }
                  }
              }
          }
          
          if (updates.length > 0) {
              // OPTIMIZATION: Get headers ONCE outside the loop
              // OPTIMIZATION: Batch Writes using getRangeList
              const sheet = Utils.getSS().getSheetByName('Orders');
              const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
              
              const statusIdx = headers.indexOf('status');
              const updateIdx = headers.indexOf('updatedat');
              const driverNameIdx = headers.indexOf('drivername');
              const driverIdIdx = headers.indexOf('driverid');
              const driverPhoneIdx = headers.indexOf('driverphone');

              const statusRanges = [];
              const clearRanges = []; // For name, id, phone
              const dateRanges = [];

              updates.forEach(u => {
                  const r = u.rowIndex;
                  if (statusIdx > -1) statusRanges.push(sheet.getRange(r, statusIdx + 1).getA1Notation());
                  if (updateIdx > -1) dateRanges.push(sheet.getRange(r, updateIdx + 1).getA1Notation());
                  
                  // Drivers fields can be cleared together? No, separate columns.
                  // Actually, getRangeList takes A1 notations, so we can pass multiple cells.
                  if (driverNameIdx > -1) clearRanges.push(sheet.getRange(r, driverNameIdx + 1).getA1Notation());
                  if (driverIdIdx > -1) clearRanges.push(sheet.getRange(r, driverIdIdx + 1).getA1Notation());
                  if (driverPhoneIdx > -1) clearRanges.push(sheet.getRange(r, driverPhoneIdx + 1).getA1Notation());
                  
                  Utils.log("AUDIT", "OrderPaymentTimeout", { orderId: u.orderId, action: 'ResetToPending_Unassigned' });
              });

              // Execute Batches
              if (statusRanges.length > 0) sheet.getRangeList(statusRanges).setValue(OrderStatus.PENDING);
              if (clearRanges.length > 0) sheet.getRangeList(clearRanges).setValue('');
              if (dateRanges.length > 0) sheet.getRangeList(dateRanges).setValue(new Date());
              
              // ISSUE-008 FIX: Sync reset to Firebase immediately so the live map is updated
              updates.forEach(u => {
                  try {
                      Firebase.update(Utils.getFirebaseOrderPath(u.orderId), {
                          status: OrderStatus.PENDING,
                          driver_id: null,
                          driver_name: null,
                          driver_phone: null,
                          updated_at: new Date().toISOString()
                      });
                  } catch (fe) { Utils.log('WARN', 'Firebase sync failed on payment timeout reset', fe.toString()); }
              });
              // Auto-resend as "Renewed Order"
              updates.forEach(u => {
                 try { OrderService.resendDetails(u.orderId, settings, true); } catch(e){
                     Utils.log("WARN", "Failed to resend renewed order", e.toString());
                 }
              });
          }
          
          return Utils.json({ ok: true, count: updates.length });
      } catch (e) {
          Utils.log("ERROR", "checkPaymentTimeouts", e.toString());
          return Utils.error(e.toString());
      } finally {
          lock.releaseLock();
      }
  },



  acceptByPhone: (payload, settings) => {
    const orderId = payload.orderId || payload.order_id;
    const phone = payload.phone;
    
    // Hardened Input Validation
    if (!orderId || typeof orderId !== 'string') return Utils.error('Invalid Order ID');
    if (!phone || typeof phone !== 'string') return Utils.error('Invalid Phone Number');
    
    // Smart Normalization is key here!
    const digits = Utils.normalizePhone(phone);
    if (digits.length < 9) return Utils.error('מספר טלפון לא תקין');
    
    const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
    // Normalize both input AND database value
    const driver = driversMap.get(digits);
    
    if (!driver) return Utils.error('NOT_REGISTERED');
    
    // Guard: Check driver status
    if (driver.status !== DriverStatus.ACTIVE) {
        return Utils.error('DRIVER_NOT_ACTIVE');
    }

    return OrderService.assignDriverToOrder(orderId, driver, settings);
  },

  acceptByTelegramWebApp: (payload, settings) => {
    const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'telegram_id', { transformKey: k => String(k).trim() });
    const driver = driversMap.get(String(payload.telegramId || '').trim());
    
    if (!driver) return Utils.error('NOT_REGISTERED');
    
    // Guard: Check driver status
    if (driver.status !== DriverStatus.ACTIVE) {
         return Utils.error('DRIVER_NOT_ACTIVE');
    }
    
    const orderId = payload.orderId || payload.order_id;
    return OrderService.assignDriverToOrder(orderId, driver, settings);
  },

  markPaymentCompleted: (payload, settings, t) => {
    // [FIX] BUG: Robust settings loading
    if (!settings) settings = SettingsService.getMap();
    
    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(CONSTANTS.LOCK_MEDIUM)) {
        return Utils.error('המערכת עמוסה, נסה שוב בעוד רגע', 503);
      }
      
      const { phone, authToken } = payload;
      const orderId = payload.orderId || payload.order_id;
      
      // OPTIMIZATION: Use getLiteData for ultra-fast lookup
      const liteData = Utils.getLiteData('Orders', Schema.Columns.Orders); // Use full schema for consistency
      const orderIdx = liteData.findIndex(o => Utils.compareIds(o.order_id, orderId));
      
      if (orderIdx === -1) return Utils.error('הזמנה לא נמצאה', 404);
      const order = liteData[orderIdx];

      // Security: Only the assigned driver can mark payment
      const storedDriverPhone = Utils.normalizePhone(order.driver_phone || order.driverphone || '');
      const inputPhone = Utils.normalizePhone(phone);
      
      let authorized = false;
      const adminPhone = Utils.normalizePhone(settings['STATION_PAYMENT_PHONE'] || '');
      const tokenToCheck = authToken || t;

      // 1. Admin Auth
      const isAdminByToken = tokenToCheck && Utils.checkAuth(tokenToCheck, 'admin', settings);
      if (isAdminByToken) {
          authorized = true;
          Utils.log("INFO", "Admin Payment Approved", { orderId, method: 'token' });
      }
      
      // 2. Driver Auth (via token)
      if (!authorized && tokenToCheck && String(tokenToCheck).startsWith('drv_')) {
          const parts = String(tokenToCheck).split('_');
          if (parts.length >= 2) {
              const driverIdFromToken = parts[1];
              const orderDriverId = order.driver_id || order.driverid;
              if (Utils.compareIds(driverIdFromToken, orderDriverId)) {
                  authorized = true;
                  Utils.log("INFO", "Driver Payment Authorized via Token", { orderId, driverId: driverIdFromToken });
              }
          }
      }
      
      // 3. Legacy/Phone Auth
      if (!authorized) {
          if (adminPhone && inputPhone && inputPhone === adminPhone) {
              authorized = true; 
          } else if (storedDriverPhone && inputPhone && storedDriverPhone === inputPhone) {
              authorized = true;
          } else if (order.driver_id || order.driverid) {
              const driverId = order.driver_id || order.driverid;
              // [REFACTOR] Use Helper
              const dPhone = Utils.getDriverPhone(driverId);
              if (dPhone === inputPhone) authorized = true;
          }
      }

      if (!authorized) {
          Utils.log("WARN", "Unauthorized Payment Attempt", { 
              orderId, 
              inputPhone, 
              hasToken: !!tokenToCheck,
              tokenPrefix: tokenToCheck ? String(tokenToCheck).substring(0, 10) : 'NONE',
              hasAdminPass: !!settings['ADMIN_PASSWORD']
          });
          return Utils.error('חוסר הרשאה - רק הנהג המשויך או המנהל יכולים לסמן תשלום');
      }

      // Check if payment already marked
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName(Schema.Sheets.ORDERS);
      
      // rowIndex is already available from liteData
      const rowIndex = orderIdx + 2; // +1 for header, +1 for 0-index -> +2 total
      
      if (rowIndex <= 1) return Utils.json({ ok: false, error: 'לא ניתן לעדכן שורה זו (הזמנה לא נמצאה)' });
      
      // Get headers from the sheet for column index lookup
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
      let paymentCompletedColIndex = headers.indexOf('paymentcompleted') + 1;
      
      if (paymentCompletedColIndex <= 0) {
          return Utils.error('System Error: Missing Payment Column');
      }
      
      // Retrieve Driver for Trusted Check
      const driverId = order.driver_id || order.driverid;
      const driversMap = Utils.getDataMap('Drivers', 'driver_id');
      const driverObj = driversMap.get(driverId);
      const isTrusted = driverObj && (String(driverObj.trusted_driver || driverObj.trusted || '').toLowerCase() === 'true');

      if (isTrusted) Utils.log("INFO", "Auto-Approving Payment for Trusted Driver", { orderId, driverId });

      const targetValue = (tokenToCheck && Utils.checkAuth(tokenToCheck, 'admin', settings)) || (adminPhone && inputPhone === adminPhone) || isTrusted
                          ? 'TRUE' 
                          : 'WAITING_APPROVAL';

      // Check currentValue without full read
      const currentVal = String(sheet.getRange(rowIndex, paymentCompletedColIndex).getValue() || '').toLowerCase();
      let alreadyPaid = (currentVal === 'true' || currentVal === 'yes' || currentVal === '1');

      if (!alreadyPaid) {
          sheet.getRange(rowIndex, paymentCompletedColIndex).setValue(targetValue);
          
          // [NEW] Also update the MAIN status column to stay in sync with the 7-step flow
          const statusColIdx = headers.indexOf('status');
          if (statusColIdx > -1) {
              const newStatus = (targetValue === 'TRUE') ? OrderStatus.PAID : OrderStatus.WAITING_APPROVAL;
              sheet.getRange(rowIndex, statusColIdx + 1).setValue(newStatus);
          }

          // Invalidate cache immediately after write
          Utils.clearCache('Orders');
      }

       // [NEW] Sync to Firebase for real-time dashboard update
       try {
           if (Firebase.isEnabled()) {
               Firebase.update(Utils.getFirebaseOrderPath(orderId), {
                   order_id: orderId,
                   payment_completed: targetValue === 'TRUE',
                   payment_status: targetValue.toLowerCase(),
                   payment_reported: true,
                   updated_at: new Date().toISOString(),
                   status: (targetValue === 'TRUE') ? OrderStatus.PAID : OrderStatus.WAITING_APPROVAL,
                   // Include data for real-time notification toasts:
                   driver_name: driverObj?.name || order.driver_name || 'נהג',
                   price: order.price || order.price_val || 'לא ידוע'
               });
           }
       } catch (e) { Utils.log("WARN", "Firebase Payment Sync Failed", e.toString()); }

      // [CRITICAL FIX]: If payment was already marked, skip sending duplicate notifications
      if (alreadyPaid) {
          Utils.log("INFO", "Payment Already Marked - Skipping duplicate notifications", { orderId });
          return Utils.json({ ok: true, message: 'תשלום כבר אושר בעבר' });
      }

      // -------- LOCK RELEASE --------
      // [FIX C-04] Release lock BEFORE external HTTP notification calls
      // to prevent blocking the entire script for 5-10s per payment.
      try { lock.releaseLock(); } catch (e) { /* already released */ }

      Utils.log("AUDIT", "PaymentMarked", { action: 'PaymentMarked', orderId, status: targetValue, driver: order.driver_name });

      // 1. Send Completion Button to Driver
      // 2. Send Payment Approved Notification (Assignment + Customer Details)
      if (targetValue === 'TRUE' && driverObj) {
           // [FIX ISSUE #9] Use retry wrapper so driver gets customer details even if first attempt fails
           try {
               NotificationService._sendWithRetry(
                   'sendPaymentApproved',
                   () => NotificationService.sendPaymentApproved(order, driverObj, settings),
                   3,
                   400
               );
           } catch (e) {
               // Log but don't block - payment is already marked
               Utils.log("ERROR", "Failed to send payment approved notification after retries", { 
                   orderId,
                   error: e.toString() 
               });
           }
           
           return Utils.json({ ok: true, message: 'תשלום אושר בהצלחה' });
      } else {
          return Utils.json({ ok: true, message: 'בקשת תשלום נשלחה לאישור המנהל' });
      }
    } catch (e) {
      return Utils.json({ ok: false, error: 'שגיאה בסימון תשלום: ' + e.toString() });
    } finally {
      // Safety check in case of unexpected errors before early release
      try { lock.releaseLock(); } catch (e) { }
    }
  },

  complete: (payload) => {
    // [FIX] BUG #4: Removed validatePayload for pickup_address/destination_address/price.
    // These fields exist in the spreadsheet row, NOT in the frontend payload.
    // The frontend only sends orderId + phone.
    // Validate only the required frontend field:
    if (!payload.orderId && !payload.order_id) return Utils.error('שגיאה: חוסר בערכים - orderId');

    const lock = LockService.getScriptLock();
    try {
      if(!lock.tryLock(CONSTANTS.LOCK_MEDIUM)) return Utils.error('System Busy');
      
      // [FIX] BUG #3: Accept both 'phone' and 'driverPhone' from frontend
      const orderId = payload.orderId || payload.order_id;
      const phone = payload.phone || payload.driverPhone || '';
      const settings = SettingsService.getMap();
      const commPct = (settings['STATION_COMMISSION_PCT'] !== undefined) ? parseFloat(settings['STATION_COMMISSION_PCT']) : CONSTANTS.COMMISSION_PCT;
      
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName(Schema.Sheets.ORDERS);
      
      // OPTIMIZATION: Use getLiteData for ultra-fast lookup
      const liteData = Utils.getLiteData(Schema.Sheets.ORDERS, Schema.Columns.Orders);
      const orderIdx = liteData.findIndex(o => Utils.compareIds(o.order_id, orderId));
      
      if (orderIdx === -1) return Utils.error(`הזמנה ${orderId} לא נמצאה בסיסטם. אנא וודא שהמספר תקין.`, 404);
      const order = liteData[orderIdx];
      const rowIndex = orderIdx + 2; // +1 header, +1 0-index

      // Get headers from the sheet for column index lookup
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);

      // Check if already completed
      if (Utils.normalizeStatus(order.status) === OrderStatus.COMPLETED) {
          const fullPrice = parseFloat(order.price) || 0;
          const commission = fullPrice * (commPct / 100);
          const driverProfit = fullPrice - commission;
          return Utils.json({ 
              ok: true, 
              message: 'הזמנה זו כבר הושלמה בעבר',
              data: {
                  orderId,
                  fullPrice,
                  commission,
                  driverProfit,
                  paymentPhone: settings['STATION_PAYMENT_PHONE'],
                  paypalEmail: settings['STATION_PAYPAL_EMAIL']
              }
          });
      }

      // FORCE FRESH READ for Payment Status to avoid race conditions
      const paymentColIndex = headers.indexOf('payment_completed') + 1;
      let livePaymentStatus = String(order.payment_completed || '');
      
      if (paymentColIndex > 0) {
          livePaymentStatus = String(sheet.getRange(rowIndex, paymentColIndex).getValue());
      }
      
      const paymentCompleted = livePaymentStatus.toLowerCase().trim();
      Utils.log("INFO", "PaymentCheckDebug", { orderId, livePaymentStatus, paymentCompleted });

      // [FIX] Strict linear flow: Only allow completing if IN_PROGRESS
      // This prevents completing a ride before it even starts.
      const normStatus = Utils.normalizeStatus(order.status);
      if (normStatus !== OrderStatus.IN_PROGRESS && normStatus !== OrderStatus.ON_ROUTE) {
          // Allow internal override or simple error
          return Utils.error(`לא ניתן לסיים נסיעה בסטטוס: ${order.status}. הסטטוס חייב להיות בתהליך (in_progress).`);
      }

      // [FIX ISSUE #10] Better payment status clarity
      if (paymentCompleted !== 'true' && paymentCompleted !== '1' && paymentCompleted !== 'yes') {
          // Distinguish between paying and not paying states
          if (paymentCompleted === 'waiting_approval') {
               return Utils.error('⏳ התשלום בטיפול בידי מנהל המערכת. אנא המתן 30 שניות ואז נסה שוב.');
          } else if (paymentCompleted === 'waiting' || paymentCompleted === 'pending') {
               return Utils.error('⏳ הבקשת תשלום בהמתנה. אנא המתן לאישור מנהל או בדוק את המצב.');
          } else {
               return Utils.error('💳 לא ניתן לסיים נסיעה לפני תשלום העמלה. אנא שלם את העמלה קודם.');
          }
      }

      // Security Check: Verify Driver Identity
      // 1. Check against `driver_phone` stored on the Order
      // 2. If mismatch or missing, check against `driver_id` stored on the Order -> Look up current phone in Drivers sheet
      
      const storedDriverPhone = Utils.normalizePhone(order.driverphone || order.driver_phone || '');
      const inputPhone = Utils.normalizePhone(phone);
      const driverId = order.driver_id || order.driverid;
      
      Utils.log("INFO", "CompleteOrderAuthCheck", { 
          orderId, 
          inputPhone, 
          storedDriverPhone,
          driverId
      });
      
      let authorized = false;

      // Primary Check: Direct Phone Match
      if (storedDriverPhone && storedDriverPhone === inputPhone) {
          authorized = true;
      } 
      
      // Secondary Check: Driver ID Lookup (Fallback)
      if (!authorized && driverId) {
          const driversMap = Utils.getDataMap('Drivers', 'driver_id');
          const driver = driversMap.get(driverId);
          if (driver) {
               const currentDriverPhone = Utils.normalizePhone(driver.phone);
               if (currentDriverPhone === inputPhone) {
                   authorized = true;
                   Utils.log("INFO", "CompleteOrderAuthSuccess_ViaDriverId", { orderId, driverId });
               } else {
                   Utils.log("WARN", "CompleteOrderAuthFail_PhoneMismatch", { orderId, inputPhone, currentDriverPhone });
               }
          } else {
               Utils.log("WARN", "CompleteOrderAuthFail_DriverNotFound", { orderId, driverId });
          }
      }

      if (!authorized) {
          // Final Admin Override Check
          const adminPhone = Utils.normalizePhone(settings['STATION_PAYMENT_PHONE'] || '');
          if (adminPhone && inputPhone === adminPhone) {
              authorized = true;
              Utils.log("INFO", "CompleteOrderAuthSuccess_AdminOverride", { orderId });
          } else if (String(order.driver_id || '').trim() === '') {
              // [NEW] Allow unassigned order key if payment verified (implicit assignment)
              // Only if we trust the caller (i.e. payment verified). 
              // But complete() is called AFTER payment.
              // So if order has no driver, should we allow?
              // YES, if payment was successful and verified.
              // We assume payment verification happened before call or is checked in paymentCompleted var.
              if (paymentCompleted === 'true' || paymentCompleted === 'yes') {
                   authorized = true;
                   Utils.log("INFO", "CompleteOrderAuthSuccess_UnassignedButPaid", { orderId });
              }
          }
      }

      if (!authorized) {
          return Utils.error(`שגיאת הרשאה: הטלפון שלך (${phone}) אינו תואם לנהג המשויך להזמנה.`);
      }

      // Financial Calculation & Validation
      const fullPrice = parseFloat(order.price) || 0;
      if (fullPrice <= 0) {
          return Utils.error('מחיר נסיעה לא תקין או חסר');
      }

      if (commPct < 0 || commPct > 50) {
          return Utils.error('אחוז עמלת תחנה לא תקין במערכת');
      }

      const commission = fullPrice * (commPct / 100);
      const driverProfit = fullPrice - commission;

      if (driverProfit < 0) {
          return Utils.error('חישוב רווח נהג שגוי - מחיר נמוך מדי');
      }

      const statusColIndex = headers.indexOf('status') + 1;
      const updatedAtColIndex = headers.indexOf('updated_at') + 1;
      const commissionColIndex = headers.indexOf('commission') + 1;
      const profitColIndex = headers.indexOf('driver_profit') + 1;

      // [FIX ISSUE #11] Write critical fields atomically in sequence with flush
      // This ensures all fields are updated together
      const updates = [];
      if (statusColIndex > 0) updates.push({ col: statusColIndex, val: OrderStatus.COMPLETED });
      if (updatedAtColIndex > 0) updates.push({ col: updatedAtColIndex, val: Utils.now() });
      if (commissionColIndex > 0) updates.push({ col: commissionColIndex, val: commission });
      if (profitColIndex > 0) updates.push({ col: profitColIndex, val: driverProfit });
      
      // Execute all updates in batch, then flush
      updates.forEach(({ col, val }) => {
        sheet.getRange(rowIndex, col).setValue(val);
      });
      
      // CRITICAL: Flush to disk immediately to ensure atomicity
      SpreadsheetApp.flush();
      Utils.clearCache('Orders');

      Utils.log("AUDIT", "OrderCompletedByDriver", { action: 'OrderCompletedByDriver', orderId, driver: order.driver_name, commission });
      
      // Update Driver Stats (Protected by Lock)
      let driverTotalRides = 0;
      let driverTotalRevenue = 0;
      
      try {
          const driversSheet = ss.getSheetByName(Schema.Sheets.DRIVERS);
          const driversData = driversSheet.getDataRange().getValues();
          const dHeaders = driversData[0].map(Utils.normalizeHeader);
          const dIdIdx = dHeaders.indexOf('driver_id');
          const ridesIdx = dHeaders.indexOf('total_rides');
          const revIdx = dHeaders.indexOf('total_revenue');
          
          if (dIdIdx > -1) {
              const dRowIndex = driversData.findIndex(r => Utils.compareIds(r[dIdIdx], order.driver_id));
              if (dRowIndex > 0) {
                  const currentRow = dRowIndex + 1;
                  let currentRides = parseInt(driversData[dRowIndex][ridesIdx] || 0) || 0;
                  let currentRev = parseFloat(driversData[dRowIndex][revIdx] || 0) || 0;
                  driverTotalRides = currentRides + 1;
                  driverTotalRevenue = currentRev + driverProfit;
                  
                  if (ridesIdx > -1) driversSheet.getRange(currentRow, ridesIdx + 1).setValue(driverTotalRides);
                  if (revIdx > -1) driversSheet.getRange(currentRow, revIdx + 1).setValue(driverTotalRevenue);
                  Utils.clearCache('Drivers');
              }
          }
      } catch (e) {
          Utils.log("WARN", "Failed to update driver stats in complete()", e.toString());
      } finally {
          // [FIX C-04] RELEASE LOCK BEFORE EXTERNAL CALLS
          lock.releaseLock();
      }
      
      // --- EXTERNAL CALLS (NON-BLOCKING) ---
      
      // 1. Firebase Sync
      try {
          const finalPayload = {
              ...Utils.toSnakeCase(order),
              status: OrderStatus.COMPLETED,
              payment_completed: true,
              paymentCompleted: true,
              completed_at: Utils.now(),
              driver_id: order.driver_id,
              driver_name: order.driver_name,
              commission: commission,
              driver_profit: driverProfit,
              total_rides: driverTotalRides,
              total_revenue: driverTotalRevenue,
              payment_phone: settings['STATION_PAYMENT_PHONE']
          };
          Firebase.set(Utils.getFirebaseOrderPath(orderId), finalPayload);
      } catch (e) { 
          Utils.log("WARN", "Firebase Cleanup Failed", e.toString()); 
      }
      
      // 2. Notification logic
      try {
          const driversMap = Utils.getDataMap('Drivers', 'driver_id');
          const driverObj = driversMap.get(order.driver_id);
          NotificationService._sendWithRetry(
              'sendRideCompleted',
              () => NotificationService.sendRideCompleted(order, driverObj || { driver_name: order.driver_name, phone: inputPhone }, settings),
              2,
              500
          );
      } catch (e) {
          Utils.log("WARN", "Failed to send ride completion notification", e.toString());
      }
      
      return Utils.json({
          ok: true,
          data: {
              orderId,
              fullPrice,
              commission,
              driverProfit,
              totalRides: driverTotalRides,
              totalRevenue: driverTotalRevenue,
              paymentPhone: settings['STATION_PAYMENT_PHONE'],
              paypalEmail: settings['STATION_PAYPAL_EMAIL']
          }
      });
    } catch (e) {
      return Utils.json({ ok: false, error: 'שגיאה בסגירת הזמנה: ' + e.toString() });
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Cancel an order with state machine validation and cleanup.
   * QA Fix BUG-001: This method was referenced but missing.
   */
  cancel: (payload, settings) => {
    const orderId = payload.orderId || payload.order_id;
    if (!orderId) return Utils.error('מזהה הזמנה חסר');

    // Delegate to update with CANCELLED status
    // update() handles auth, state machine, Firebase sync, stats, and driver cleanup
    const cancelPayload = {
      orderId: orderId,
      order_id: orderId,
      updates: { status: OrderStatus.CANCELLED },
      authToken: payload.authToken,
      phone: payload.phone,
      driverPhone: payload.driverPhone,
      request: payload.request
    };

    Utils.log('AUDIT', 'OrderCancelRequested', { orderId });
    return OrderService.update(cancelPayload, settings);
  },
  /**
   * Physically removes completed orders older than 20 minutes from Firebase
   * to keep the live map and RTDB tidy.
   */
  cleanupOldFirebaseOrders: () => {
    if (!Firebase.isEnabled()) return;
    
    const orders = Firebase.get('active_orders');
    if (!orders.ok || !orders.data) return;
    
    const now = Date.now();
    const CUTOFF_MS = 5 * 60 * 1000; // 5 minutes (User requested)
    const removedIds = [];
    
    Object.keys(orders.data).forEach(id => {
      const o = orders.data[id];
      const status = Utils.normalizeStatus(o.status);
      
      if (status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED) {
        const updated = Utils.parseDate(o.updated_at || o.created_at);
        if (updated && (now - updated.getTime() > CUTOFF_MS)) {
          Firebase.remove(Utils.getFirebaseOrderPath(id));
          removedIds.push(id);
        }
      }
    });
    
    if (removedIds.length > 0) {
      Utils.log("AUDIT", `Cleanup: Removed ${removedIds.length} old orders from Firebase`, { ids: removedIds });
    }
  }
};
