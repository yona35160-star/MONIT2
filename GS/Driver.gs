/**
 * Driver Service
 * Driver management, registration, location updates, portal data
 * 
 * Dependencies: Utils.gs, Config.gs, OrderService (circular - needs init)
 */
const DriverService = {
  getAll: (payload = {}) => {
      const offset = parseInt(payload.offset) || 0;
      const limit = Math.min(parseInt(payload.limit) || 50, 100);

      const allDrivers = Utils.getData('Drivers');
      // Performance: Fetch only necessary columns for stats calculation
      const allOrders = Utils.getLiteData('Orders', ['driver_id', 'status', 'price']);
      
      // [FIX] Calculate stats on the fly from Orders
      const statsMap = {};
      allOrders.forEach(o => {
          if (!o.driver_id) return;
          const did = String(o.driver_id).trim();
          if (!statsMap[did]) statsMap[did] = { rides: 0, revenue: 0 };
          
          const status = Utils.normalizeStatus(o.status);
          if (status === 'completed' || status === 'paid') {
              statsMap[did].rides++;
              // Extract numeric price
              const price = Utils.parsePrice(o.price);
              statsMap[did].revenue += price;
          }
      });
      
      Utils.log("DEBUG", "DriverService: Stats calculated", { 
          totalOrders: allOrders.length, 
          statsEntries: Object.keys(statsMap).length,
          statsSample: JSON.stringify(statsMap).substring(0, 500)
      });

      const activeDrivers = allDrivers
          .filter(d => d.status !== DriverStatus.DELETED)
          .map(d => {
              const did = String(d.driver_id || d.driverId || "").trim();
              const today = statsMap[did] || { rides: 0, revenue: 0 };
              
              return {
                ...d,
                today_rides: today.rides,
                today_revenue: today.revenue,
                total_rides: parseInt(d.total_rides || 0) || today.rides, // Fallback to today if none stored
                total_revenue: parseFloat(d.total_revenue || 0) || today.revenue
              };
          });

      // Sort by Revenue Descending
      activeDrivers.sort((a, b) => b.total_revenue - a.total_revenue);

      const items = activeDrivers.slice(offset, offset + limit);

      return Utils.json({ 
        ok: true, 
        data: { 
          items,
          total: activeDrivers.length,
          hasMore: offset + limit < activeDrivers.length
        } 
      });
  },
  
  getOne: (id) => {
    const driversMap = Utils.getDataMap('Drivers', 'driver_id');
    const d = driversMap.get(id);
    if (!d || d.status === DriverStatus.DELETED) return Utils.json({ ok: false, error: 'Not found' });
    return Utils.json({ ok: true, data: d });
  },

  register: (payload, initialStatus) => {
    // SECURITY: Ensure we have a column for the session secret
    Utils.ensureHeaders('Drivers', ['session_secret']);

    // Phase 1: Input Validation
    const validation = ValidationService.validate(payload, 'driver');
    if (!validation.valid) {
        return Utils.json({ ok: false, error: 'Validation failed', errors: validation.errors });
    }

    // Use Map-based lookup to avoid scanning sheets repeatedly
    const safePhone = Utils.normalizePhone(payload.phone);
    const driversMap = Utils.getDataMap('Drivers', 'phone', { transformKey: k => Utils.normalizePhone(k) });
    if (driversMap.get(safePhone)) {
        return Utils.json({ 
            ok: false, 
            error: 'DRIVER_ALREADY_REGISTERED', 
            message: 'נהג זה כבר רשום במערכת. אנא היכנס במקום להירשם.' 
        });
    }


    // Proceed with atomic append under a short lock
    try {
      return Utils.withLock(30000, () => {
        let sheet = Utils.getSS().getSheetByName('Drivers');
        if (!sheet) {
            Utils.log("WARN", "Drivers sheet missing in register. Calling setupSystem.", {});
            setupSystem();
            sheet = Utils.getSS().getSheetByName('Drivers');
            if (!sheet) return Utils.json({ ok: false, error: 'System Error: Drivers DB missing' });
        }
        
        const data = sheet.getDataRange().getValues(); // re-check inside lock
        const headers = data[0].map(Utils.normalizeHeader);
        const phoneIdx = headers.indexOf('phone');
        const sheetPhone = Utils.formatPhoneForSheet(payload.phone);

        // Re-check existence to avoid race
        if (phoneIdx > -1) {
          for (let i = 1; i < data.length; i++) {
            if (Utils.normalizePhone(data[i][phoneIdx]) === safePhone) {
              return Utils.json({ ok: false, error: 'Driver already registered' });
            }
          }
        }

        // [ATOMIC FIX] Use ScriptProperties for robust ID generation
        const scriptProps = PropertiesService.getScriptProperties();
        let lastDrvId = parseInt(scriptProps.getProperty('LAST_DRIVER_ID') || '1000');
        const newIdNum = lastDrvId + 1;
        const newId = `DRV-${newIdNum}`;
        scriptProps.setProperty('LAST_DRIVER_ID', String(newIdNum));
        const sessionSecret = Utils.generateSalt(16); // Secure Random Secret

        // Dynamically build row to match headers
        const row = new Array(headers.length).fill('');
        
        // Helper to set value by header name
        const setVal = (h, val) => {
            const idx = headers.indexOf(Utils.normalizeHeader(h));
            if (idx > -1) row[idx] = val;
        };

        setVal('driver_id', newId);
        setVal('driver_name', Utils.sanitize(payload.driver_name || payload.driverName));
        setVal('phone', sheetPhone);
        setVal('telegram_id', payload.telegram_id || payload.telegramId || '');
        setVal('status', initialStatus);
        setVal('service_area', Utils.sanitize(payload.service_area || payload.serviceArea));
        setVal('license_number', Utils.sanitize(payload.license_number || payload.licenseNumber));
        setVal('taxi_plate_number', Utils.sanitize(payload.taxi_plate_number || payload.taxiPlateNumber));
        setVal('total_rides', 0);
        setVal('created_at', Utils.now());
        setVal('telegram_username', payload.telegram_username || payload.telegramUsername || '');
        setVal('updated_at', Utils.now());
        setVal('average_rating', 5.0);
        setVal('total_revenue', 0);
        setVal('session_secret', sessionSecret);

        // Google Profile Fields
        if (payload.google_id) setVal('google_id', payload.google_id);
        if (payload.email) setVal('email', payload.email);
        if (payload.given_name) setVal('given_name', payload.given_name);
        if (payload.family_name) setVal('family_name', payload.family_name);
        if (payload.profile_picture) setVal('profile_picture', payload.profile_picture);
        if (payload.email_verified !== undefined) setVal('email_verified', payload.email_verified);

        if (!Utils.appendRowWithRetry(sheet, row)) {
          return Utils.json({ ok: false, error: 'DB Write Failed' });
        }

        Utils.log('AUDIT', 'DriverRegistered', { driverId: newId, driverName: payload.driverName, phone: safePhone, status: initialStatus });

        return Utils.json({ 
          ok: true, 
          data: { 
            driver_id: newId, 
            driver_name: payload.driverName, 
            phone: safePhone, 
            telegram_id: payload.telegramId || '', 
            token: `drv_${newId}_${sessionSecret}` 
          } 
        });
      });
    } catch (e) {
      return Utils.json({ ok: false, error: 'Registration Busy: ' + e.toString() });
    }
  },

  registerAndAssign: (payload, settings) => {
    // 1. Register with ACTIVE status
    const regRes = JSON.parse(DriverService.register(payload, DriverStatus.ACTIVE).getContent());
    
    let driverObj = null;

    if (regRes.ok) {
        driverObj = regRes.data;
    } else if (regRes.error === 'DRIVER_ALREADY_REGISTERED' || regRes.error === 'Driver already registered') {
      const digits = Utils.normalizePhone(payload.phone);
      const driversMap = Utils.getDataMap('Drivers', 'phone', { transformKey: k => Utils.normalizePhone(k) });
      driverObj = driversMap.get(digits);
    } else {
        return Utils.json(regRes);
    }

    if (!driverObj) return Utils.json({ ok: false, error: 'Driver lookup failed after reg' });

    // Guard: Check if soft deleted or blocked
    if (driverObj.status === DriverStatus.DELETED || driverObj.status === DriverStatus.BLOCKED) {
        return Utils.json({ ok: false, error: 'DRIVER_NOT_ACTIVE' });
    }

    // 2. Direct Assignment
    const oid = payload.orderId || payload.order_id;
    if (oid) {
      // [FIX] Ensure driverObj is normalized to snake_case before assignment 
      // to avoid property name mismatch (camelCase driverId vs snake_case driver_id)
      const normalizedDriver = Utils.toSnakeCase(driverObj);
      return OrderService.assignDriverToOrder(oid, normalizedDriver, settings);
    }
    
    return Utils.json({ ok: true, data: driverObj });
  },

  updateProfile: (payload) => {
    const driverId = payload.driverId || payload.driver_id;
    const updates = payload.updates;
    if (!driverId || !updates) return Utils.error('Missing required fields');

    return Utils.withLock(10000, () => {
        const sheet = Utils.getSS().getSheetByName('Drivers');
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(Utils.normalizeHeader);
        const idIdx = headers.indexOf('driverid');
        
        let rowIndex = -1;
        for(let i=1; i<data.length; i++) {
           if (data[i][idIdx] === driverId) {
               rowIndex = i + 1;
               break;
           }
        }

        if (rowIndex === -1) return Utils.error('Driver not found');

        // Allowed updates (maps frontend camelCase or snake_case to sheet column)
        // [FIX IMPROVEMENT-003] 'phone' intentionally excluded - it is the primary auth identifier.
        // Phone changes must go through an admin action to prevent session invalidation.
        const allowedFields = {
            'driverName': 'driver_name',
            'driver_name': 'driver_name',
            'serviceArea': 'service_area',
            'service_area': 'service_area',
            'licenseNumber': 'license_number',
            'license_number': 'license_number',
            'taxiPlateNumber': 'taxi_plate_number',
            'taxi_plate_number': 'taxi_plate_number',
            'insurance_expiry': 'insurance_expiry',
            'license_expiry': 'license_expiry',
            'car_doc_expiry': 'car_doc_expiry',
            'car_model': 'car_model',
            'car_color': 'car_color'
        };

        let updated = false;
        Object.keys(updates).forEach(key => {
            if (allowedFields[key]) {
                const headerName = allowedFields[key];
                const colIdx = headers.indexOf(Utils.normalizeHeader(headerName));
                if (colIdx > -1) {
                    let val = updates[key];
                    if (key === 'phone') val = Utils.formatPhoneForSheet(val);
                    sheet.getRange(rowIndex, colIdx + 1).setValue(val);
                    updated = true;
                }
            }
        });

        if (updated) {
            Utils.clearCache('Drivers');
            return Utils.json({ ok: true });
        } else {
            return Utils.json({ ok: true, message: 'No changes made' });
        }
    });
  },

  login: (phone) => {
    // SECURITY: Ensure 'session_secret' column exists
    Utils.ensureHeaders('Drivers', ['session_secret']);

    const cleanPhone = Utils.normalizePhone(phone);
    // Force fresh read? Login is rare, but let's use map first
    const driversMap = Utils.getDataMap('Drivers', 'phone', { transformKey: k => Utils.normalizePhone(k) });
    const driver = driversMap.get(cleanPhone);
    
    if (driver && driver.status !== DriverStatus.DELETED) {
      // GENERATE NEW SESSION SECRET ON LOGIN
      const newSecret = Utils.generateSalt(16);
      const sheet = Utils.getSS().getSheetByName('Drivers');
      
      // Find row index via TextFinder first (faster), fallback to scan for legacy ID variants
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
      const idIdx = headers.indexOf('driverid');
      let rowIndex = -1;

      if (idIdx > -1) {
          const match = sheet.getRange(2, idIdx + 1, Math.max(sheet.getLastRow() - 1, 1), 1)
            .createTextFinder(String(driver.driver_id))
            .matchEntireCell(true)
            .findNext();
          if (match) rowIndex = match.getRow();
      }

      if (rowIndex === -1) {
          const data = sheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
              if (Utils.compareIds(data[i][idIdx], driver.driver_id)) {
                  rowIndex = i + 1;
                  break;
              }
          }
      }
      
      if (rowIndex > -1) {
          // Update Secret
          Utils.updateRow(sheet, rowIndex, { 'session_secret': newSecret });
          // Invalidate Cache to ensure immediate effect
          Utils.clearCache('Drivers');
          
          return Utils.json({ 
            ok: true, 
            data: { 
              token: `drv_${driver.driver_id}_${newSecret}`, 
              driverId: driver.driver_id 
            } 
          });
      }
    }
    return Utils.json({ ok: false, error: 'Driver not found' });
  },

  softDelete: (driverId) => {
    const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(Utils.normalizeHeader);
    const idIdx = headers.indexOf('driverid');
    const statusIdx = headers.indexOf('status');

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
        if (Utils.compareIds(data[i][idIdx], driverId)) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) return Utils.json({ ok: false, error: 'Driver not found' });

    // Set status to DELETED
    sheet.getRange(rowIndex, statusIdx + 1).setValue(DriverStatus.DELETED);
    Utils.log("AUDIT", "DriverDeleted", { driverId });
    Utils.clearCache('Drivers');

    return Utils.json({ ok: true });
  },

  getPortalData: (token, payload = {}) => {
    if (!token) return Utils.json({ ok: false, error: 'No token' });
    
    // ISSUE-002 FIX: Fully validate the session secret
    const settings = SettingsService.getMap();
    if (!Utils.checkAuth(token, 'driver', settings)) {
      Utils.log('WARN', 'getPortalData: Invalid or expired token', { tokenPrefix: String(token).substring(0, 10) });
      return Utils.json({ ok: false, error: 'Invalid or expired token' });
    }

    // Extract driver_id from validated token (format: drv_DRVID_secret)
    const parts = String(token).split('_');
    const driverId = parts.length > 1 ? parts[1] : null;
    if (!driverId) return Utils.json({ ok: false, error: 'Malformed token' });
    
    const driversMap = Utils.getDataMap('Drivers', 'driver_id');
    const driver = driversMap.get(driverId);
    if (!driver || driver.status === DriverStatus.DELETED) return Utils.json({ ok: false, error: 'Driver not found' });
    
    // MISSING-008 & PERF-002 FIX: Use getLiteData and implement pagination
    const page = Math.max(1, parseInt(payload.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(payload.limit) || 20), 100);
    const offset = (page - 1) * limit;

    const allOrders = Utils.getLiteData('Orders', [
      'order_id', 'status', 'pickup_address', 'destination_address', 'price', 'created_at', 'completed_at'
    ]);
    
    const myRides = allOrders.filter(o => Utils.compareIds(o.driver_id, driverId));
    
    // Sort by Date Desc (created_at or completed_at)
    myRides.sort((a, b) => {
      const da = new Date(b.created_at || b.timestamp || 0).getTime();
      const db = new Date(a.created_at || a.timestamp || 0).getTime();
      return da - db;
    });

    const stats = {
      totalRides: myRides.length,
      totalEarnings: myRides.reduce((acc, curr) => acc + (parseFloat(curr.price)||0), 0),
      // [FIX BUG-004] Calculate real completion rate instead of hardcoding 100
      completionRate: (() => {
        const completedRides = myRides.filter(o => {
          const s = Utils.normalizeStatus(o.status);
          return s === 'completed' || s === 'paid';
        }).length;
        const cancelledRides = myRides.filter(o => Utils.normalizeStatus(o.status) === 'cancelled').length;
        const totalClosed = completedRides + cancelledRides;
        return totalClosed > 0 ? Math.round((completedRides / totalClosed) * 100) : 100;
      })()
    };

    return Utils.json({
      ok: true,
      data: {
        driver: Utils.toSnakeCase(driver),
        stats,
        recentRides: myRides.slice(offset, offset + limit).map(Utils.toSnakeCase),
        pagination: {
          page,
          limit,
          total: myRides.length,
          hasMore: offset + limit < myRides.length
        }
      }
    });
  },

  updateLocation: (payload) => {
    if (!Utils.validateLatLng(payload.lat, payload.lng)) {
        return Utils.json({ ok: false, error: 'Invalid Coordinates' });
    }

    const driverId = payload.driver_id || payload.driverId;
    const nowMs = Date.now();
    
    // 1. ALWAYS Update Firebase (Real-time & Low Cost)
    Firebase.update(`drivers/${driverId}/location`, {
        lat: payload.lat,
        lng: payload.lng,
        updated_at: Utils.now(),
        timestamp: nowMs
    });

    return Utils.json({ ok: true });
  },

  linkTelegram: (phone, telegramData) => {
    const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
    const data = sheet.getDataRange().getValues();
    const rawHeaders = data[0];
    const headers = rawHeaders.map(Utils.normalizeHeader);
    const phoneIdx = headers.indexOf('phone');
    if (phoneIdx === -1) return Utils.json({ ok: false, error: 'System Error: Phone column not found' });
    
    const tgIdIdx = headers.indexOf('telegramid'); 
    const tgUserIdx = headers.indexOf('telegramusername');

    const cleanPhone = Utils.normalizePhone(phone);

    for (let i = 1; i < data.length; i++) {
        // Check phone match
        if (Utils.normalizePhone(data[i][phoneIdx]) === cleanPhone) {
            // Update Telegram Details
            if (tgIdIdx > -1) sheet.getRange(i + 1, tgIdIdx + 1).setValue(telegramData.id);
            if (tgUserIdx > -1) sheet.getRange(i + 1, tgUserIdx + 1).setValue(telegramData.username || '');
            try { CacheService.getScriptCache().remove('data_Drivers'); if (Utils._memCache) Utils._memCache['Drivers'] = null; } catch (e) {}
            
            Utils.log("AUDIT", "Driver Linked Telegram", { driverIdx: i, phone: cleanPhone, tgId: telegramData.id });
            return Utils.json({ ok: true, driverName: data[i][headers.indexOf('drivername')] });
        }
    }
    return Utils.json({ ok: false, error: 'Driver not found' });
  },

  updateStatus: (driverId, status) => {
    if (!driverId || !status) return Utils.json({ ok: false, error: 'Missing fields' });
    
    // Validate transient status
    const validStatuses = ['online', 'offline', 'busy'];
    if (!validStatuses.includes(status)) return Utils.json({ ok: false, error: 'Invalid status' });

    // ISSUE-004 FIX: Verify fixed status in spreadsheet (e.g., ACTIVE/BLOCKED)
    const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id');
    const driver = driversMap.get(driverId);
    
    if (!driver) return Utils.json({ ok: false, error: 'Driver not found' });
    
    const sheetStatus = String(driver.status || '').toUpperCase();
    if (sheetStatus === 'BLOCKED') {
      return Utils.json({ ok: false, error: 'Account blocked. Contact admin.' });
    }
    if (sheetStatus === 'PENDING') {
      return Utils.json({ ok: false, error: 'Account pending approval.' });
    }

    Firebase.update(`drivers/${driverId}`, {
        status: status,
        last_seen: Utils.now(),
        updated_at: Date.now()
    });

    return Utils.json({ ok: true });
  },

  /**
   * Update driver rating based on new feedback
   */
  updateRating: (driverId, newRating) => {
    if (!driverId || isNaN(newRating)) return false;
    
    return Utils.withLock(10000, () => {
        const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(Utils.normalizeHeader);
        const idIdx = headers.indexOf('driverid');
        const ratingIdx = headers.indexOf('averagerating');
        const countIdx = headers.indexOf('totalratings');

        let rowIndex = -1;
        for (let i = 1; i < data.length; i++) {
            if (Utils.compareIds(data[i][idIdx], driverId)) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) return false;

        const currentRating = parseFloat(data[rowIndex-1][ratingIdx]) || 5.0;
        const currentCount = parseInt(data[rowIndex-1][countIdx]) || 0;
        
        const newCount = currentCount + 1;
        const updatedRating = ((currentRating * currentCount) + newRating) / newCount;

        if (ratingIdx > -1) sheet.getRange(rowIndex, ratingIdx + 1).setValue(updatedRating.toFixed(2));
        if (countIdx > -1) sheet.getRange(rowIndex, countIdx + 1).setValue(newCount);

        Utils.clearCache('Drivers');
        return true;
    });
  },

  /**
   * MISSING-006 FIX: Get all drivers pending admin approval
   */
  getPending: () => {
    const allDrivers = Utils.getData(Schema.Sheets.DRIVERS);
    const pending = allDrivers.filter(d => 
      String(d.status || '').toLowerCase() === DriverStatus.PENDING.toLowerCase()
    );
    return Utils.json({ ok: true, data: { items: pending, total: pending.length } });
  },

  /**
   * MISSING-006 FIX: Approve a pending driver (set status to ACTIVE)
   */
  approve: (driverId) => {
    if (!driverId) return Utils.error('Missing driverId');
    return Utils.withLock(10000, () => {
      const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(Utils.normalizeHeader);
      const idIdx = headers.indexOf('driverid');
      const statusIdx = headers.indexOf('status');

      for (let i = 1; i < data.length; i++) {
        if (Utils.compareIds(data[i][idIdx], driverId)) {
          sheet.getRange(i + 1, statusIdx + 1).setValue(DriverStatus.ACTIVE);
          Utils.clearCache('Drivers');
          Utils.log('AUDIT', 'DriverApproved', { driverId });
          return Utils.json({ ok: true, message: `Driver ${driverId} approved` });
        }
      }
      return Utils.error('Driver not found');
    });
  },

  /**
   * MISSING-006 FIX: Reject a pending driver (soft-delete with reason)
   */
  reject: (driverId, reason) => {
    if (!driverId) return Utils.error('Missing driverId');
    Utils.log('AUDIT', 'DriverRejected', { driverId, reason: reason || 'No reason given' });
    return DriverService.softDelete(driverId);
  },

  /**
   * Fleet Management: Check for expiring documents
   */
  checkDocumentExpiry: (settings) => {
    try {
      const allDrivers = Utils.getData(Schema.Sheets.DRIVERS);
      const now = new Date();
      const warningDays = 30;
      
      const alerts = [];

      allDrivers.forEach(d => {
        if (d.status === DriverStatus.DELETED) return;

        const docs = [
          { type: 'ביטוח', date: d.insurance_expiry, key: 'insurance' },
          { type: 'רישיון נהיגה', date: d.license_expiry, key: 'license' },
          { type: 'מסמכי רכב', date: d.car_doc_expiry, key: 'car_doc' }
        ];

        docs.forEach(doc => {
          if (!doc.date) return;
          const expiry = new Date(doc.date);
          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 0) {
            alerts.push({
              driverId: d.driver_id,
              driverName: d.driver_name,
              docType: doc.type,
              status: 'EXPIRED',
              expiryDate: Utils.formatDateTime(expiry),
              daysLeft: diffDays
            });
          } else if (diffDays <= warningDays) {
            alerts.push({
              driverId: d.driver_id,
              driverName: d.driver_name,
              docType: doc.type,
              status: 'EXPIRING_SOON',
              expiryDate: Utils.formatDateTime(expiry),
              daysLeft: diffDays
            });
          }
        });
      });

      return Utils.json({ ok: true, data: alerts });
    } catch (e) {
      Utils.log("ERROR", "checkDocumentExpiry Failed", e.toString());
      return Utils.error("Failed to check document expiry");
    }
  }
};

