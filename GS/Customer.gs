/**
 * Customer Service  
 * Manages customer profiles and ride history
 * 
 * Dependencies: Utils.gs
 */


const CustomerService = {
  /**
   * MISSING-002 FIX: Get paginated ride history for a passenger by phone number.
   * Called by the passenger profile screen via getPassengerHistory action.
   */
  getHistory: (payload, settings, token) => {
    try {
      if (!token || !Utils.checkAuth(token, 'passenger', settings)) {
        return Utils.error('Unauthorized: Invalid or missing passenger token', 401);
      }

      const rawPhone = payload.phone || payload.customerPhone || payload.customer_phone;
      if (!rawPhone) return Utils.error('Missing phone number');

      const normPhone = Utils.normalizePhone(rawPhone);
      if (!normPhone) return Utils.error('Invalid phone number');

      const page  = Math.max(1, parseInt(payload.page) || 1);
      const limit = Math.min(parseInt(payload.limit) || 10, 50);
      const offset = (page - 1) * limit;

      // Fetch only necessary columns for performance
      const allOrders = Utils.getLiteData('Orders', [
        'order_id', 'customer_phone', 'pickup_address', 'destination_address',
        'price', 'status', 'created_at', 'driver_name', 'pickup_datetime'
      ]);

      // Filter orders for this passenger (phone match)
      const myOrders = allOrders.filter(o => {
        const ph = o.customer_phone || o.customerphone || '';
        return Utils.normalizePhone(String(ph)) === normPhone;
      });

      // Sort: most recent first
      myOrders.sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      });

      const total = myOrders.length;
      const items = myOrders.slice(offset, offset + limit);

      return Utils.json({
        ok: true,
        data: {
          items,
          total,
          page,
          limit,
          hasMore: offset + limit < total
        }
      });
    } catch (e) {
      Utils.log('ERROR', 'CustomerService.getHistory failed', e.toString());
      return Utils.error('Failed to fetch ride history');
    }
  },

  updateProfile: (orderPayload) => {
    try {
      const name = Utils.sanitize(orderPayload.customerName);
      const price = parseFloat(orderPayload.price) || 0;
      const rawPhone = orderPayload.customerPhone;
      const normPhone = Utils.normalizePhone(rawPhone);

      let sheet = Utils.getSS().getSheetByName('Customers');
      if (!sheet) {
          Utils.log('WARN', 'Customers sheet missing in CustomerService. Calling setupSystem.');
          setupSystem();
          sheet = Utils.getSS().getSheetByName('Customers');
          if (!sheet) throw new Error('Failed to create Customers sheet');
      }

      // Use Map-based lookup by normalized phone
      const customersMap = Utils.getDataMap('Customers', 'customer_phone', { transformKey: k => Utils.normalizePhone(k) });
      const existing = customersMap.get(normPhone);

      const now = Utils.now();
      const sheetPhone = Utils.formatPhoneForSheet(rawPhone);

      if (!existing) {
        try {
          const hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
          const phoneCol = hdrs.indexOf('customer_phone');
          if (phoneCol > -1) sheet.getRange(1, phoneCol + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
          
          const row = new Array(hdrs.length).fill('');
          const setVal = (h, val) => {
            const idx = hdrs.indexOf(Utils.normalizeHeader(h));
            if (idx > -1) row[idx] = val;
          };
          
          setVal('customer_phone', sheetPhone);
          setVal('customer_name', name);
          setVal('total_rides', 1);
          setVal('total_spent', price);
          setVal('created_at', now);
          setVal('last_ride_date', now);
          if (orderPayload.session_secret) setVal('session_secret', orderPayload.session_secret);

          Utils.appendRowWithRetry(sheet, row);
        } catch (e) { Utils.log('WARN', 'Failed appending new Customer', e.toString()); }

        Utils.log('AUDIT', 'New Customer Profile', { phone: sheetPhone });
      } else {
        // Update in place
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(Utils.normalizeHeader);
        const phoneIdx = headers.indexOf('customer_phone');
        const ridesIdx = headers.indexOf('total_rides');
        const spentIdx = headers.indexOf('total_spent');
        
        let rowIndex = -1;
        for (let i = 1; i < data.length; i++) {
          if (Utils.normalizePhone(data[i][phoneIdx]) === normPhone) { rowIndex = i + 1; break; }
        }
        
        if (rowIndex === -1) {
          Utils.log('WARN', 'Customer exists in map but row not found (appending new)', { phone: normPhone });
          const row = new Array(headers.length).fill('');
          const setVal = (h, val) => {
            const idx = headers.indexOf(Utils.normalizeHeader(h));
            if (idx > -1) row[idx] = val;
          };
          setVal('customer_phone', sheetPhone);
          setVal('customer_name', name);
          setVal('total_rides', 1);
          setVal('total_spent', price);
          setVal('created_at', now);
          setVal('last_ride_date', now);
          if (orderPayload.session_secret) setVal('session_secret', orderPayload.session_secret);
          Utils.appendRowWithRetry(sheet, row);
        } else {
          const currentRides = parseInt(data[rowIndex-1][ridesIdx]) || 0;
          const currentSpent = parseFloat(data[rowIndex-1][spentIdx]) || 0;
          
          const updates = {};
          if (price > 0 || !orderPayload.session_secret) {
             updates['total_rides'] = currentRides + 1;
             updates['total_spent'] = currentSpent + price;
             updates['last_ride_date'] = now;
          }
          if (orderPayload.session_secret) updates['session_secret'] = orderPayload.session_secret;
          
          Utils.updateRow(sheet, rowIndex, updates);
          
          try { CacheService.getScriptCache().remove('data_Customers'); if (Utils._memCache) Utils._memCache['Customers'] = null; } catch (e) {}
        }
      }
    } catch (e) {
      Utils.log('WARN', 'CustomerService Update Failed', e.toString());
    }
  }
};
