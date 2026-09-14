/**
 * Utils Module
 * Comprehensive utility functions for the Taxi Dispatch System
 * 
 * Dependencies: Config.gs (for CONSTANTS, OrderStatus, Schema)
 * Used by: ALL other services
 */

const Utils = {
  // Constants
  CACHE_TTL: 21600, // 6 hours
  MEM_CACHE_TTL: 2 * 60 * 1000, // 2 minutes
  CACHE_PREFIX: 'tx_v4_', 
  STATS_KEY: 'dashboard_stats_counters_v1',

  _ss: null,
  getSS: () => {
    // Audit Fix: Prioritize ScriptProperties to avoid hardcoded IDs in source
    try {
      const propId = PropertiesService.getScriptProperties().getProperty('TARGET_SPREADSHEET_ID');
      if (propId) return SpreadsheetApp.openById(propId);
    } catch (e) { /* ignore */ }

    if (typeof TARGET_SPREADSHEET_ID !== 'undefined' && TARGET_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /** 
   * Standardized Phone Normalization 
   * Removes non-digits, ensures leading 0 if 10 digits/starts with 5, etc.
   * Can be enhanced to handle +972.
   */
  normalizePhone: (phone) => {
    return Utils.PhoneFormatter.normalize(phone);
  },


  // Centralized Phone Formatting Logic
  PhoneFormatter: {
    normalize: (p) => {
      if (!p) return '';
      let str = String(p).replace(/\D/g, '');
      
      // Handle international format: 972XXXXXXXXX → 0XXXXXXXXX
      if (str.startsWith('972')) {
        str = '0' + str.substring(3);
      }
      
      // Handle 9-digit without leading 0: 5XXXXXXXX → 05XXXXXXXX
      if (str.length === 9 && str.startsWith('5')) {
        str = '0' + str;
      }
      
      
      // [FIX] Handle 11-digit starting with 972: 972XXXXXXXXX (alternative) → 0XXXXXXXXX
      if (str.length === 12 && str.startsWith('972')) {
        str = '0' + str.substring(3);
      }
      
      // Ensure 10-digit format (0XXXXXXXXX)
      if (str.length === 10 && str.startsWith('0')) {
        return str; // Already correct
      }
      if (str.length === 10 && str.startsWith('5')) {
        return '0' + str.substring(1); // 5XXXXXXXX → 05XXXXXXXX
      }
      
      return str;
    },
    toSheet: (p) => Utils.PhoneFormatter.normalize(p),
    toApi: (p) => {
      let str = Utils.PhoneFormatter.normalize(p);
      if (str.startsWith('0')) str = '972' + str.substring(1);
      return str ? '+' + str : '';
    },
    toWhatsappJid: (p, isGroup = false) => {
      let str = Utils.PhoneFormatter.normalize(p);
      if (str.startsWith('0')) str = '972' + str.substring(1);
      return str ? (isGroup ? `${str}@g.us` : `${str}@s.whatsapp.net`) : '';
    },
    isValid: (p) => {
      const norm = Utils.PhoneFormatter.normalize(p);
      return /^0[2-9]\d{7,8}$/.test(norm);
    }
  },

  /**
   * Recursively converts object keys to camelCase.
   * Useful for normalizing frontend snake_case payloads.
   */
  toCamelCase: (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(Utils.toCamelCase);

    const newObj = {};
    Object.keys(obj).forEach(key => {
      const newKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
      newObj[newKey] = Utils.toCamelCase(obj[key]);
    });
    return newObj;
  },

  /**
   * getWhatsAppUrls: Centralized logic for picking bridge URLs.
   * Returns an array of valid target URLs based on BRIDGE_MODE.
   */
  getWhatsAppUrls: (settings) => {
    const mode = String(settings['BRIDGE_MODE'] || 'AUTO').toUpperCase();
    const local = settings['WHATSAPP_BRIDGE_URL'];
    const render = settings['WHATSAPP_RENDER_URL'];
    const fallback = settings['WHATSAPP_FALLBACK_URL'];
    
    const targets = [];
    if (mode === 'LOCAL' && local) {
      targets.push(local);
    } else if (mode === 'RENDER' && render) {
      targets.push(render);
    } else {
      // AUTO: local first (live tunnel / this machine), then cloud, then extra fallback
      if (local) targets.push(local);
      if (render && render !== local) targets.push(render);
      if (fallback && fallback !== local && fallback !== render) targets.push(fallback);
    }
    return targets.map(u => String(u).replace(/\/$/, '')); // Normalize (no trailing slash)
  },

  /**
   * isValidSecret: Checks if a settings value is a real usable secret (not a placeholder).
   */
  isValidSecret: (val) => {
    if (!val) return false;
    const s = String(val).trim();
    return s.length > 3 && s !== '[HIDDEN]' && s !== '[SECURELY_STORED_IN_PROPS]' && s !== '***' && s !== 'secret-bridge-key';
  },


  // Format phone for writing to Sheets: always return with leading 0 for display
  formatPhoneForSheet: (p) => Utils.PhoneFormatter.toSheet(p),

  // Format phone for external APIs / tel: links — always +972... e.g. +972533396519
  formatPhoneForApi: (p) => Utils.PhoneFormatter.toApi(p),

  // Format phone for WhatsApp JID (no plus) e.g. 972533396519
  formatPhoneForWhatsappJid: (p) => {
    const jid = Utils.PhoneFormatter.toWhatsappJid(p);
    return jid.split('@')[0]; // Baileys often expects just the digits part or the full JID depending on call
  },

  /**
   * Helper to safely get an object from a row based on headers
   */
  getRowObject: (sheet, rowIndex, headers = null) => {
    if (!headers) headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
    const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  },

  /**
   * Helper to convert a row array to an object using headers
   */
  getRowMap: (row, headers) => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  },

  /**
   * Helper to update specific columns in a row
   */
  updateRow: (sheet, rowIndex, updates, headers = null) => {
    if (!headers) headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
    Object.keys(updates).forEach(key => {
      const colIdx = headers.indexOf(Utils.normalizeHeader(key));
      if (colIdx > -1) {
        const val = updates[key];
        const cell = sheet.getRange(rowIndex, colIdx + 1);
        cell.setValue(val);
        // Special handling for phone columns to enforce text
        if (key.includes('phone')) {
             try { cell.setNumberFormat('@'); } catch(e){}
        }
      }
    });

    // Invalidate Cache after update
    const sheetName = sheet.getName();
    try {
      Utils.clearCache(sheetName);
    } catch(e) {
      Utils.log("WARN", "Cache Invalidation Failed", { sheetName, error: e.toString() });
    }

    // Firebase Dual-Write (non-blocking, never throws)
    try {
      if (ArchitectureSwitch.isEnabled('ENABLE_FIREBASE_SYNC')) {
        const fullRow = Utils.getRowObject(sheet, rowIndex, headers);
        Firebase.syncSheetRow(sheetName, fullRow);
      }
    } catch(e) {
      Utils.log("WARN", "Firebase dual-write failed in updateRow", { sheetName, error: e.toString() });
    }
  },

  // appendRowWithRetry is defined later in this file (canonical version with exponential backoff).
  // BUG-001 FIX: Removed duplicate definition that was here.

  /**
   * Record notification attempts/results to a `Notifications` sheet for traceability.
   * entry: { requestId, bridgeMessageId, method, jid, targetGroupJid, driverId, orderId, text, status, rawResponse }
   */
  _notificationBuffer: [],
  _logBuffer: [], // PERF-003: Buffer for system logs

  recordNotification: (entry) => {
    Utils._notificationBuffer.push(entry);
    
    // [PHASE II] Real-time sync to Firebase for UI feedback
    if (Firebase.isEnabled() && entry.orderId && entry.status) {
      try {
        const path = `order_messages/${entry.orderId}/${entry.requestId || 'init'}`;
        Firebase.set(path, {
          status: entry.status,
          method: entry.method || 'whatsapp',
          timestamp: Date.now(),
          requestId: entry.requestId || ''
        });
      } catch (e) { 
        Utils.log("WARN", "Firebase notification status sync failed", { orderId: entry.orderId, error: e.toString() });
      }
    }
  },

  flushNotificationLogs: () => {
    if (Utils._notificationBuffer.length === 0) return;
    try {
        const ss = Utils.getSS();
        let sheet = ss.getSheetByName('Notifications');
        if (!sheet) {
            sheet = ss.insertSheet('Notifications');
            const headers = ['timestamp','requestId','bridgeMessageId','method','jid','targetGroupJid','driverId','orderId','text','status','rawResponse'];
            sheet.appendRow(headers);
            sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f3f3');
            sheet.setFrozenRows(1);
        }

        const date = new Date();
        const rows = Utils._notificationBuffer.map(entry => {
            const clippedText = entry.text ? (String(entry.text).substring(0, 500)) : '';
            const raw = entry.rawResponse ? (typeof entry.rawResponse === 'string' ? entry.rawResponse.substring(0,1000) : JSON.stringify(entry.rawResponse).substring(0,1000)) : '';
            return [
                date,
                entry.requestId || '',
                entry.bridgeMessageId || '',
                entry.method || 'whatsapp',
                entry.jid || '',
                entry.targetGroupJid || '',
                entry.driverId || '',
                entry.orderId || '',
                clippedText,
                entry.status || '',
                raw
            ];
        });

        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
        Utils._notificationBuffer = []; // Clear buffer
    } catch (e) {
        console.error("Failed to flush notification logs", e);
    }
  },

   findNotificationByRequestId: (requestId) => {
    try {
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName('Notifications');
      if (!sheet) return null;
      
      const finder = sheet.getRange(1, 2, sheet.getLastRow(), 1).createTextFinder(String(requestId)).matchEntireCell(true);
      const next = finder.findNext();
      
      if (next) {
          const rowIndex = next.getRow();
          const rowData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
          
          return {
            row: rowIndex,
            requestId: rowData[1],
            bridgeMessageId: rowData[2],
            method: rowData[3],
            jid: rowData[4],
            targetGroupJid: rowData[5],
            driverId: rowData[6],
            orderId: rowData[7],
            text: rowData[8],
            status: rowData[9],
            rawResponse: rowData[10]
          };
      }
      return null;
    } catch (e) { return null; }
  },

  updateNotificationStatus: (requestId, status, bridgeMessageId, rawResponse) => {
    try {
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName('Notifications');
      if (!sheet) return false;
      
      // Search only in the requestId column (column B, index 2)
      const searchRange = sheet.getRange(1, 2, sheet.getLastRow(), 1);
      const finder = searchRange.createTextFinder(String(requestId)).matchEntireCell(true);
      const next = finder.findNext();
      
      if (next) {
          const rowIndex = next.getRow();
          const now = new Date().toISOString();
          
          // Column 3 for bridgeMessageId
          if (bridgeMessageId !== null && bridgeMessageId !== undefined) sheet.getRange(rowIndex, 3).setValue(bridgeMessageId);
          // Column 10 for status
          if (status) sheet.getRange(rowIndex, 10).setValue(status);
          // Column 11 for rawResponse
          if (rawResponse !== null && rawResponse !== undefined) sheet.getRange(rowIndex, 11).setValue(typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse));
          // Column 1 for timestamp
          sheet.getRange(rowIndex, 1).setValue(now);

          // [PHASE II] Push updated status to Firebase
          const orderId = sheet.getRange(rowIndex, 8).getValue(); // Get orderId from column 8
          const method = sheet.getRange(rowIndex, 4).getValue();  // Get method from column 4
          if (Firebase.isEnabled() && orderId) {
            try {
              const path = `order_messages/${orderId}/${requestId}`;
              Firebase.update(path, {
                status: status || 'updated',
                updated_at: Date.now()
              });
            } catch (fe) { /* ignore */ }
          }
          return true;
      }
      return false;
    } catch (e) { Utils.log('WARN', 'updateNotificationStatus failed', e.toString()); return false; }
  },

  validateLatLng: (lat, lng) => {
      const nLat = parseFloat(lat);
      const nLng = parseFloat(lng);
      return !isNaN(nLat) && !isNaN(nLng) && nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
  },

  // retryWithBackoff is defined later in this file (canonical version with while loop and jitter).
  // BUG-002 FIX: Removed duplicate definition that was here.

  repairPhoneNumberFormats: () => {
      return Utils.migratePhoneColumns(['Orders', 'Drivers', 'Customers']);
  },

  /**
   * isUrlAllowed: Checks if a URL domain is in the allowed whitelist (SSRF protection).
   */
  isUrlAllowed: (url) => {
      try {
          if (!url) return false;
          // [FIX] Support both full URLs and partials
          const domain = (url.includes('://') ? url.split('/')[2] : url.split('/')[0]).toLowerCase();
          const ALLOWED = [
              'api.telegram.org', 
              'firebaseio.com', 
              'googleapis.com', 
              'onrender.com', 
              'render.com', 
              'trycloudflare.com', 
              'ngrok-free.app', 
              'ngrok-free.dev', 
              'ngrok.io', 
              'netlify.app',
              'localhost'
          ];
          return ALLOWED.some(d => domain === d || domain.endsWith('.' + d));
      } catch (e) { return false; }
  },

  /**
   * Helper to fetch with exponential backoff retry.
   */
  fetchWithRetry: (url, options, maxRetries = 2) => {
      // [FIX] SSRF Protection: Guard outgoing requests
      if (!Utils.isUrlAllowed(url)) {
          Utils.log("SECURITY", "Blocked outgoing request to unauthorized domain", { url });
          throw new Error(`Domain not authorized: ${url}`);
      }

      // Use centralized retry helper for consistent backoff behavior
      return Utils.retryWithBackoff(() => UrlFetchApp.fetch(url, options), {
          maxAttempts: Math.max(1, maxRetries + 1),
          baseDelay: 500,
          jitter: 300
      });
  },

  /**
   * Safe Data Getter with multi-level caching.
   * Static sheets like 'Settings', 'Drivers' use script cache.
   * 'Orders' uses short-lived internal cache only.
   */
  getData: (sheetName, skipCache = false, limitLast = 0) => {
    // 1. Handle Settings separately
    if (sheetName === 'Settings') return SettingsService.getMap();

    // 2. ScriptCache for Orders AND Drivers
    const scriptCache = CacheService.getScriptCache();
    const cacheKey = Utils.CACHE_PREFIX + (limitLast > 0 ? `data_${sheetName}_${limitLast}` : `data_${sheetName}`);
    if (!skipCache) {
        // Fast Internal Memory Cache (Global in GAS per request)
        if (!Utils._memCache) Utils._memCache = {};
        if (Utils._memCache[cacheKey]) return Utils._memCache[cacheKey];

        // Shared Script Cache
        const cached = scriptCache.get(cacheKey);
        if (cached) {
            try { 
                const parsed = JSON.parse(cached);
                Utils._memCache[cacheKey] = parsed;
                return parsed;
            } catch (e) { /* fallthrough */ }
        }
    }

    // 3. Internal script-level cache for redundant calls in same request
    if (!Utils._memCache) Utils._memCache = {};
    if (!skipCache && Utils._memCache[sheetName]) return Utils._memCache[sheetName];

    // REMOVED forced SpreadsheetApp.flush() - only flush when strictly necessary for write consistency
    const sheet = Utils.getSS().getSheetByName(sheetName);
    if (!sheet) return [];
    
    // Optimization: Read only last N rows if limitLast > 0
    let data;
    const lastRow = sheet.getLastRow();
    
    if (limitLast > 0 && lastRow > 1) {
        // Always read header (row 1) + last limitLast rows
        const startRow = Math.max(2, lastRow - limitLast + 1);
        const numRows = lastRow - startRow + 1;
        
        const headersValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
        let rowsValues = [];
        if (numRows > 0) {
            rowsValues = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
        }
        data = [headersValues[0], ...rowsValues];
    } else {
        data = sheet.getDataRange().getValues();
    }

    if (data.length <= 1) return [];
    
    const canonicalMap = Utils.getCanonicalMap();
    const headers = data[0].map(h => {
       const norm = Utils.normalizeHeader(h);
       return canonicalMap[norm] || norm;
    });

    const result = data.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => {
          if (h) obj[h] = row[i];
      });
      return obj;
    });

    if (!skipCache) {
        Utils._memCache[sheetName] = result;
        if (sheetName === 'Orders') {
            try { scriptCache.put(cacheKey, JSON.stringify(result), CONSTANTS.CACHE_TTL_ORDERS); } catch (e) { /* ignore large data */ }
        } else if (sheetName === 'Drivers') {
            try { scriptCache.put(cacheKey, JSON.stringify(result), CONSTANTS.CACHE_TTL_DRIVERS); } catch (e) { /* ignore large data */ }
        }
    }
    return result;
  },

  getCanonicalMap: () => {
    return {
      'orderid': 'order_id', 'מזהההזמנה': 'order_id',
      'customername': 'customer_name', 'שמלקוח': 'customer_name',
      'customerphone': 'customer_phone', 'טלפוןלקוח': 'customer_phone',
      'pickupaddress': 'pickup_address', 'כתובתאיסוף': 'pickup_address',
      'destinationaddress': 'destination_address', 'כתובתיעד': 'destination_address',
      'pickupdatetime': 'pickup_datetime', 'מועדאיסוף': 'pickup_datetime',
      'drivername': 'driver_name', 'שמנהג': 'driver_name',
      'driverid': 'driver_id', 'מזההנהג': 'driver_id',
      'status': 'status', 'סטטוס': 'status',
      'phone': 'phone', 'טלפון': 'phone', // Added for Drivers sheet
      'payment_method': 'payment_method',
      'paymentmethod': 'payment_method',
      'created_at': 'created_at',
      'createdat': 'created_at',
      'timestamp': 'timestamp',
      
      // [FIX] Missing mappings for low-priority items
      'notes': 'notes',
      'pickup_comments': 'pickup_notes', // Align with schema
      'pickup_notes': 'pickup_notes',
      'commission': 'commission',
      'station_commission': 'commission',
      'price': 'price', 'מחיר': 'price',
      'createdat': 'created_at', 'נוצרב': 'created_at',
      'updatedat': 'updated_at', 'עודכןב': 'updated_at',
      'pickupnotes': 'pickup_notes', 'הערותאיסוף': 'pickup_notes',
      'destinationnotes': 'destination_notes', 'הערותיעד': 'destination_notes',
      'pickupexactaddress': 'pickup_exact_address', 'כתובתמדויקתאיסוף': 'pickup_exact_address',
      'destinationexactaddress': 'destination_exact_address', 'כתובתמדויקתיעד': 'destination_exact_address',
      'pickuplat': 'pickup_lat', 'pickuplng': 'pickup_lng',
      'destinationlat': 'destination_lat', 'destinationlng': 'destination_lng',
      'telegramid': 'telegram_id', 'מזההטלגרם': 'telegram_id',
      'servicearea': 'service_area', 'אזורשירות': 'service_area',
      'licensenumber': 'license_number', 'מספררישיון': 'license_number',
      'taxiplatenumber': 'taxi_plate_number', 'מספרלוחית': 'taxi_plate_number',
      'paymentcompleted': 'payment_completed', 'שולם': 'payment_completed',
      'totalrides': 'total_rides', 'סהכנסיעות': 'total_rides',
      'totalrevenue': 'total_revenue', 'סהכהכנסות': 'total_revenue',
      'averagerating': 'average_rating', 'דירוגממוצע': 'average_rating',
      'idempotencykey': 'idempotency_key',
      'driverphone': 'driver_phone',
      'sessionsecret': 'session_secret',
      'broadcastmsgid': 'broadcast_msg_id',
      'whatsappmsgid': 'whatsapp_msg_id',
      'driver_id': 'driver_id',
      'driver_name': 'driver_name',
      'order_id': 'order_id',
      'customer_name': 'customer_name',
      'customer_phone': 'customer_phone',
      'pickup_address': 'pickup_address',
      'destination_address': 'destination_address',
      
      // Additional standard mappings
      'googleid': 'google_id',
      'google_id': 'google_id',
      'totalspent': 'total_spent',
      'total_spent': 'total_spent',
      'givenname': 'given_name',
      'given_name': 'given_name',
      'familyname': 'family_name',
      'family_name': 'family_name',
      'profilepicture': 'profile_picture',
      'profile_picture': 'profile_picture',
      'emailverified': 'email_verified',
      'email_verified': 'email_verified',
      'insuranceexpiry': 'insurance_expiry',
      'insurance_expiry': 'insurance_expiry',
      'licenseexpiry': 'license_expiry',
      'license_expiry': 'license_expiry',
      'cardocexpiry': 'car_doc_expiry',
      'car_doc_expiry': 'car_doc_expiry',
      'lastridedate': 'last_ride_date',
      'last_ride_date': 'last_ride_date'
    };
  },

  /**
   * Robust Price Parsing
   * Handles various currency symbols, commas, and whitespace.
   */
  parsePrice: (priceStr) => {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;
    const cleaned = String(priceStr).replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  /**
   * SEC-003 FIX: Rate Limiter using CacheService with accurate expiry window.
   * Prevents "sliding window" reset on every increment by storing expiration timestamp.
   * @param {string} key - Unique key for the throttled action
   * @param {number} limit - Max requests
   * @param {number} windowSec - Time window in seconds
   */
  checkRateLimit: (key, limit, windowSec) => {
    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = Utils.CACHE_PREFIX + `rate_${key}`;
      const cached = cache.get(cacheKey);
      const now = Date.now();
      
      let data;
      if (cached) {
        try { data = JSON.parse(cached); } catch(e) { /* fallback if old format */ }
      }
      
      if (!data || data.expiresAt < now) {
        // New window
        const newData = { count: 1, expiresAt: now + (windowSec * 1000) };
        cache.put(cacheKey, JSON.stringify(newData), windowSec);
        return true;
      }
      
      if (data.count >= limit) return false;
      
      // Increment count without changing expiry
      data.count++;
      const remainingSec = Math.max(1, Math.floor((data.expiresAt - now) / 1000));
      cache.put(cacheKey, JSON.stringify(data), remainingSec);
      return true;
    } catch (e) {
      console.warn("RateLimit check failed (fail open):", e);
      return true; 
    }
  },

  json: (data) => ContentService.createTextOutput(JSON.stringify(Utils.toCamelCase(data))).setMimeType(ContentService.MimeType.JSON),

  error: (msg, code = 500, logLevel = "ERROR") => {
    Utils.log(logLevel, msg, { code });

    // Friendly Hebrew Messages Mapping
    const errorMap = {
        'Unauthorized': 'אין לך הרשאה לבצע פעולה זו',
        'Rate limit exceeded': 'ניסית יותר מדי פעמים, אנא המתן ונסה שוב מאוחר יותר',
        'Order not found': 'ההזמנה לא נמצאה במערכת',
        'Driver not found': 'הנהג לא נמצא במערכת',
        'System Busy': 'המערכת עמוסה כרגע, נסה שוב בעוד מספר שניות',
        'Invalid Token': 'פג תוקף ההתחברות, אנא התחבר מחדש',
        'Payment failed': 'התשלום נכשל, אנא פנה למנהל התחנה',
        'Unknown Error': 'שגיאה כללית במערכת'
    };

    // Partial match check
    let userMessage = errorMap[msg] || msg;
    if (msg.includes('Rate limit')) userMessage = errorMap['Rate limit exceeded'];
    if (msg.includes('Unauthorized')) userMessage = errorMap['Unauthorized'];

    return Utils.json({ ok: false, error: msg, code: code, userMessage });
  },

  /**
   * Validates that a payload contains required fields.
   * returns {ok: boolean, missing: string[]}
   */
  validatePayload: (payload, required) => {
    if (!payload) return { ok: false, missing: required };
    const missing = required.filter(field => {
        let val = payload[field];
        
        // [FIX] Support camelCase fallback for required field checks
        if (val === undefined || val === null || String(val).trim() === '') {
            const camelKey = field.replace(/(_\w)/g, m => m[1].toUpperCase());
            val = payload[camelKey];
        }
        
        return val === undefined || val === null || String(val).trim() === '';
    });
    return { ok: missing.length === 0, missing };
  },

  /**
   * Sanitizes input to prevent formula injection and preserve data integrity.
   * Prefixing with ' is a common strategy for Sheets text preservation.
   */
  sanitize: (input) => {
    if (input === null || input === undefined) return '';
    let s = String(input);
    // Remove potential formula injections
    if (s.startsWith('=')) s = "'" + s;
    return s;
  },

  ensureHeaders: (sheetName, requiredHeaders) => {
    const sheet = Utils.getSS().getSheetByName(sheetName);
    if (!sheet) return;
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
    const normalizedCurrent = currentHeaders.map(Utils.normalizeHeader);
    
    requiredHeaders.forEach((h, i) => {
        const norm = Utils.normalizeHeader(h);
        if (!normalizedCurrent.includes(norm)) {
            sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
            Utils.log("AUDIT", `Added missing header to ${sheetName}`, { header: h });
        }
    });
  },
  
  /**
   * Physically renames headers in all key sheets to match the canonical snake_case names.
   * This ensures the spreadsheet looks professional and matches the internal logic.
   */
  standardizeHeaders: () => {
    const sheetsToStandardize = ['Orders', 'Drivers', 'Settings', 'Notifications', 'Logs', 'Ratings', 'Customers'];
    const canonicalMap = Utils.getCanonicalMap();
    const ss = Utils.getSS();
    const steps = [];

    sheetsToStandardize.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return;
      
      const headerRange = sheet.getRange(1, 1, 1, lastCol);
      const originalHeaders = headerRange.getValues()[0];
      const newHeaders = originalHeaders.map(h => {
        const norm = Utils.normalizeHeader(h);
        const canonical = canonicalMap[norm];
        return canonical || h; // Keep original if no canonical mapping
      });

      // Update if any header changed
      let changed = false;
      for (let i = 0; i < originalHeaders.length; i++) {
        if (originalHeaders[i] !== newHeaders[i]) {
          changed = true;
          break;
        }
      }

      if (changed) {
        headerRange.setValues([newHeaders]);
        steps.push(`Standardized ${sheetName}`);
        Utils.log("AUDIT", `Standardized headers for ${sheetName}`, { old: originalHeaders, new: newHeaders });
      }
    });

    return Utils.json({ ok: true, steps });
  },

  // issueAdminToken and verifyAdminToken are defined later in this file (canonical adm_ format).
  // BUG-003 FIX: Removed duplicate JWT HS256-style definitions that conflicted with the adm_ HMAC format used by checkAuth.

  checkAuth: (token, type, settings) => {
    if (!token) {
        return false;
    }

    // [SEC-005] Support Firebase ID Tokens (JWTs start with eyJ)
    if (String(token).startsWith('eyJ')) {
       return Utils.validateFirebaseTokenCached(token, type, settings);
    }
    
    if (type === 'admin') {
      // 0. Super-Admin / Bridge API Key access
      // This allows the bridge server to perform admin actions (like updating its URL)
      const bridgeKey = Utils.getSecret('BRIDGE_API_KEY');
      if (bridgeKey && token && String(token).trim() === String(bridgeKey).trim()) {
          return true;
      }

      // Utils.log('DEBUG', 'checkAuth admin check', { tokenPrefix: String(token).substring(0, 10) });

      // Silence logs: If this is clearly a driver token, it's not an admin.
      if (token && String(token).trim().startsWith('drv_')) return false;

      // Prefer new signed tokens
      try {
        if (Utils.verifyAdminToken(token)) return true;
      } catch (e) {
        Utils.log('INFO', 'verifyAdminToken threw', e.toString());
      }

      // Fallback to legacy HMAC comparison from Settings sheet
    const stored = String(settings['ADMIN_PASSWORD'] || '').trim();
    if (!stored) {
      Utils.log("ERROR", "checkAuth: ADMIN_PASSWORD missing in settings!", { hasSettings: !!settings });
      return false;
    }

      const jwtSecret = settings['JWT_SECRET'] || stored; 
      const currentDate = new Date().getDate();
      const tokenData = stored + jwtSecret + currentDate;
      const expected = 'adm_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tokenData)).substring(0, 32);
      const isValid = token === expected;
      
      return isValid;
    }
    
    if (type === 'driver') {
      if (!token.startsWith('drv_')) return false;
      const parts = token.split('_');
      if (parts.length < 3) return false;
      const driverId = parts[1];
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id', { transformKey: k => String(k || '').trim() });
      const driver = driversMap.get(String(driverId || '').trim());
      if (!driver) return false;
      
      const sessionSecret = String(driver.session_secret || '').trim();
      if (!sessionSecret) return false; // Force re-login if no secret (security upgrade)
      
      return parts[2] === sessionSecret;
    }

    if (type === 'passenger') {
      if (!token.startsWith('pas_')) return false;
      const parts = token.split('_');
      if (parts.length < 3) return false;
      const phone = parts[1];
      const customersMap = Utils.getDataMap(Schema.Sheets.CUSTOMERS, 'customer_phone', { transformKey: k => Utils.normalizePhone(k) });
      const customer = customersMap.get(Utils.normalizePhone(phone));
      if (!customer) return false;
      
      const sessionSecret = String(customer.session_secret || '').trim();
      if (!sessionSecret) return false;
      
      return parts[2] === sessionSecret;
    }
    
    return false;
  },
  
  formatDate: (date, timezone, pattern) => Utilities.formatDate(date, timezone || "Asia/Jerusalem", pattern || "yyyy-MM-dd"),

  now: () => Utilities.formatDate(new Date(), "Asia/Jerusalem", "yyyy-MM-dd HH:mm:ss"),

  calculateDistance: (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  normalizeHeader: (h) => {
    if (!h) return '';
    const clean = String(h).trim().toLowerCase().replace(/[^a-z0-9א-ת]/g, '');
    const canonical = Utils.getCanonicalMap()[clean];
    return canonical || clean;
  },

  compareIds: (id1, id2) => {
    if (id1 === null || id1 === undefined || id2 === null || id2 === undefined) return false;
    const clean = (id) => String(id).trim().toUpperCase().replace(/^TAXI-/, '');
    return clean(id1) === clean(id2);
  },

  getFirebaseOrderKey: (orderId) => {
    if (!orderId) return '';
    return String(orderId).trim().toUpperCase().replace(/^TAXI-/, '');
  },

  getFirebaseOrderPath: (orderId) => `active_orders/${Utils.getFirebaseOrderKey(orderId)}`,

  parseDate: (str) => {
    if (!str) return null;
    if (str instanceof Date) return str;
    
    const strNormalized = String(str).trim();
    if (strNormalized === '') return null;

    // ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(strNormalized)) {
        return new Date(strNormalized);
    }

    // dd/MM/yyyy HH:mm:ss
    const match = strNormalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?: (\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (match) {
        const [_, day, month, year, hours, mins, secs] = match;
        // Month is 0-indexed in JS
        const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hours || 0), Number(mins || 0), Number(secs || 0));
        if (!isNaN(d.getTime())) return d;
    }
    
    // Fallback for native Date parsing
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  },

  formatDateTime: (dateStr) => {
      if (!dateStr) return '';
      const date = Utils.parseDate(dateStr);
      if (!date) return dateStr;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  /**
   * Centralized Status Normalization
   * Maps Hebrew/English variations to canonical status enums.
   */
  normalizeStatus: (status) => {
    const s = String(status || "").trim().toLowerCase();
    
    // COMPLETED
    if (['completed', 'done', 'finished', 'הושלם', 'בוצע', 'נסיעה הושלמה'].some(x => s === x)) return OrderStatus.COMPLETED;
    
    // CANCELLED
    if (['cancelled', 'canceled', 'void', 'בוטל', 'בוטלה'].some(x => s === x)) return OrderStatus.CANCELLED;
    
    // PENDING
    if (['pending', 'new', 'searching', 'ממתין', 'חדש', 'מחפש'].some(x => s === x)) return OrderStatus.PENDING; 
    
    if (['broadcasted', 'הופץ', 'שודר'].some(x => s === x)) return OrderStatus.BROADCASTED;
    
    // ASSIGNED
    if (['assigned', 'משובץ'].some(x => s === x)) return OrderStatus.ASSIGNED;

    // ARRIVED
    if (['arrived', 'driver_waiting', 'הגיע', 'הנהג הגיע'].some(x => s === x)) return OrderStatus.ARRIVED;

    // WAITING_APPROVAL
    if (['waiting_approval', 'ממתין לאישור', 'דווח תשלום'].some(x => s === x)) return OrderStatus.WAITING_APPROVAL;

    // PAID
    if (['paid', 'payment_confirmed', 'שולם', 'תשלום אושר'].some(x => s === x)) return OrderStatus.PAID;

    // ACTIVE / ON_ROUTE
    if (['confirmed', 'active', 'מאושר', 'בדרך', 'מאושר בדרך'].some(x => s === x)) return OrderStatus.CONFIRMED;

    // IN_PROGRESS
    if (['in_progress', 'on_route', 'picked_up', 'passenger_on_board', 'בנסיעה', 'נוסע ברכב'].some(x => s === x)) return OrderStatus.IN_PROGRESS;
    
    return 'other';
  },

  // One-time migration: normalize phone display and set cells to TEXT
  migratePhoneColumns: (sheetNames) => {
    sheetNames = sheetNames || ['Orders', 'Drivers', 'Customers'];
    const ss = Utils.getSS();
    const results = {};
    try {
      Utils.log('INFO', 'Phone migration started', { sheets: sheetNames });
      sheetNames.forEach(name => {
        const sheet = ss.getSheetByName(name);
        if (!sheet) { results[name] = 'MISSING_SHEET'; return; }
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < 2 || lastCol < 1) { results[name] = 'NO_DATA'; return; }

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(Utils.normalizeHeader);
        const phoneCols = [];
        headers.forEach((h, i) => {
          if (['phone', 'driverphone', 'customerphone', 'driver_phone', 'customer_phone'].indexOf(h) > -1) phoneCols.push(i);
        });

        if (phoneCols.length === 0) { results[name] = 'NO_PHONE_COLUMN'; return; }

        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        // Transform in-memory
        for (let r = 0; r < data.length; r++) {
          phoneCols.forEach(colIdx => {
            try {
              data[r][colIdx] = Utils.formatPhoneForSheet(data[r][colIdx]);
            } catch (e) {
              // keep original on error
            }
          });
        }

        // Write back and enforce TEXT format on phone columns
        sheet.getRange(2, 1, lastRow - 1, lastCol).setValues(data);
        phoneCols.forEach(colIdx => {
          try {
            // Set entire column (headers + data) to plain text to preserve leading zeros on edits
            sheet.getRange(1, colIdx + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
          } catch (e) { /* ignore */ }
        });

        results[name] = { rowsProcessed: lastRow - 1, phoneColumns: phoneCols.length };
      });
      Utils.log('INFO', 'Phone migration completed', { results });
      return Utils.json({ ok: true, results });
    } catch (e) {
      Utils.log('ERROR', 'Phone migration failed', e.toString());
      return Utils.error('Phone migration failed: ' + e.toString());
    }
  },

  /**
   * PERF-003 FIX: Batch Logger. Buffers log messages in memory and flushes them 
   * to the Spreadsheet at the end of execution to save Quota.
   */
  log: (level, message, data = {}) => {
    const ALLOWED_LEVELS = ['CRITICAL', 'ERROR', 'AUDIT', 'WARN', 'DEBUG', 'INFO'];
    const lvl = String(level).toUpperCase();
    if (!ALLOWED_LEVELS.includes(lvl)) return;
    
    // 1. Stackdriver Logging (Immediate, visible in Cloud Console)
    if (lvl === 'ERROR' || lvl === 'CRITICAL') {
        console.error(`[${lvl}] ${message}`, data);
    } else {
        console.log(`[${lvl}] ${message}`, data);
    }

    // 2. Buffer for Sheet Logging
    if (lvl === 'INFO') return; // Don't persist INFO to sheet per user request

    const enriched = Object.assign({}, data, {
        timestamp: Utils.now(),
        scriptVersion: SCRIPT_VERSION,
        user: (Session.getEffectiveUser && Session.getEffectiveUser().getEmail()) || 'unknown',
        action: (data && data.action) ? data.action : message
    });

    Utils._logBuffer.push([enriched.timestamp, lvl, enriched.action, JSON.stringify(enriched)]);
    
    // Force immediate write for CRITICAL errors
    if (lvl === 'CRITICAL') Utils.flushLogs();
  },

  /**
   * PERF-003: Writes all buffered logs to the 'Logs' sheet in a single batch.
   * Should be called at the end of doGet/doPost.
   */
  flushLogs: () => {
    if (!Utils._logBuffer || Utils._logBuffer.length === 0) return;
    
    try {
      const ss = Utils.getSS();
      let sheet = ss.getSheetByName('Logs');
      if (!sheet) {
        sheet = ss.insertSheet('Logs');
        sheet.appendRow(['timestamp','level','action','data']);
        sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground("#f3f3f3");
        sheet.setFrozenRows(1);
      }
      
      const rowsToWrite = [...Utils._logBuffer];
      Utils._logBuffer = []; // Clear immediately to prevent double writing if re-triggered

      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToWrite.length, 4).setValues(rowsToWrite);
    } catch (e) {
      console.error("Failed to flush logs to sheet", e);
    }
  },

  /**

   * Secrets & PropertiesService helpers
   */
  /**
   * isValidSecret: Checks if a string is a real credential and not a placeholder.
   */
  isValidSecret: (val) => {
      if (!val) return false;
      const s = String(val).trim();
      if (s === '' || s === 'undefined' || s === 'null') return false;
      if (s.includes('[HIDDEN]')) return false;
      if (s.includes('[SECURELY_STORED_IN_PROPS]')) return false;
      if (s.includes('***')) return false;
      if (s.length < 8) return false; // Most keys are longer
      return true;
  },

  getSecret: (key) => {
    try {
      const props = PropertiesService.getScriptProperties();
      const v = props.getProperty(key);
      if (Utils.isValidSecret(v)) return String(v);
    } catch (e) {
      Utils.log("WARN", "getSecret: ScriptProperties failed", { key, error: e.toString() });
    }
    try {
      const s = SettingsService.getMap();
      if (s && Utils.isValidSecret(s[key])) return String(s[key]);
    } catch (e) { 
      Utils.log("WARN", "getSecret: Settings fallback failed", { key, error: e.toString() });
    }
    return null;
  },

  setSecret: (key, value) => {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty(key, String(value));
      return true;
    } catch (e) {
      Utils.log('ERROR', 'setSecret failed', { key, err: e.toString() });
      return false;
    }
  },

  generateSalt: (len = 16) => {
    const bytes = Utilities.getUuid().replace(/-/g, '') + (new Date()).getTime();
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)).substring(0, len);
  },

  hashPassword: (password, salt) => {
    salt = salt || '';
    const pepper = Utils.getSecret('PASSWORD_PEPPER') || 'taxi_secure_pepper_2026';
    let hash = String(salt) + '|' + String(password) + '|' + pepper;
    
    // Iterative hashing (10,000 rounds) to mimic PBKDF2
    for (let i = 0; i < 10000; i++) {
        const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, hash + i);
        hash = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
    }
    
    return hash;
  },

  verifyPassword: (password, salt, expectedHash) => {
    if (!expectedHash) return false;
    const h = Utils.hashPassword(password, salt);
    return h === expectedHash;
  },

  /**
   * Lightweight signed token implementation for admin actions.
   * Token format: adm_<base64(payload)>.<base64(signature)>
   * payload = JSON.stringify({iat, exp})
   */
  issueAdminToken: (ttlSeconds = 3600) => {
    const secret = Utils.getSecret('JWT_SECRET') || Utils.getSecret('ADMIN_PASSWORD') || '';
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (ttlSeconds || 3600);
    const payload = { iat, exp, sub: 'admin' };
    const payloadStr = JSON.stringify(payload);
    const sigBytes = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, payloadStr, secret);
    const sig = Utilities.base64Encode(sigBytes);
    const token = 'adm_' + Utilities.base64Encode(payloadStr) + '.' + sig;
    return token;
  },

  verifyAdminToken: (token) => {
    try {
      if (!token || !token.startsWith('adm_')) return false;
      const secret = Utils.getSecret('JWT_SECRET') || Utils.getSecret('ADMIN_PASSWORD') || '';
      const parts = token.substring(4).split('.');
      if (parts.length !== 2) return false;
      const payloadStr = Utilities.newBlob(Utilities.base64Decode(parts[0])).getDataAsString();
      const sigProvided = parts[1];
      const expectedSig = Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, payloadStr, secret));
      if (sigProvided !== expectedSig) return false;
      const payload = JSON.parse(payloadStr);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && now > payload.exp) return false;
      return true;
    } catch (e) {
      Utils.log('ERROR', 'verifyAdminToken failed', e.toString());
      return false;
    }
  },

  /**
   * Create Firebase Custom Token for Secure Realtime Database Access
   * Generates an RS256 signed JWT using a securely stored Service Account Key
   */
  createFirebaseCustomToken: (uid, claims = {}) => {
    const settings = typeof SettingsService !== 'undefined' ? SettingsService.getMap() : {};
    // Extract credentials securely
    const privateKeyRaw = Utils.getSecret('FIREBASE_PRIVATE_KEY') || settings['FIREBASE_PRIVATE_KEY'];
    const clientEmail = Utils.getSecret('FIREBASE_CLIENT_EMAIL') || settings['FIREBASE_CLIENT_EMAIL'];

    if (!privateKeyRaw || !clientEmail || privateKeyRaw.includes('HIDDEN')) {
      Utils.log("ERROR", "Service Account missing for Custom Token");
      throw new Error('Firebase Service Account not configured in Script Properties');
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3600, // 1 hour expiration
      uid: String(uid).trim(),
      claims: claims
    };

    const encode = (obj) => Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
    const toSign = encode(header) + "." + encode(payload);

    try {
      const signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKey);
      const signatureStr = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
      return toSign + "." + signatureStr;
    } catch (e) {
      Utils.log("ERROR", "RSA Signature Error", e.toString());
      throw new Error("Invalid RSA Private Key format");
    }
  },

  /**
   * Convenience Lock wrapper using script lock. timeoutMs in ms.
   */
  withLock: (timeoutMs, fn) => {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(Math.max(30000, timeoutMs || 60000));
      return fn();
    } finally {
      try { lock.releaseLock(); } catch (e) { Utils.log("DEBUG", "Lock Release Failed", e.toString()); }
    }
  },

  /**
   * Build a Map for fast lookups from sheet data
   */
  getDataMap: (sheetName, keyField, options) => {
    const map = new Map();
    const transform = options?.transformKey || (k => k);
    
    // ✅ Fetch data from sheet
    const arr = Utils.getData(sheetName);
    
    // Safety check for empty data
    if (!arr || arr.length === 0) return map;
    
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      // Guard against null items (rare but possible with some array methods)
      if (item && item[keyField] !== undefined && item[keyField] !== null) {
        try {
          const rawKey = item[keyField];
          const tKey = transform(rawKey);
          if (typeof tKey !== 'undefined' && tKey !== null) map.set(String(tKey), item);
        } catch (e) { 
          Utils.log("DEBUG", "Data Map Item Process Failed", { sheetName, error: e.toString() });
        }
      }
    }
    return map;
  },

  /**
   * Centralized Cache Clearing
   * Clears all variations of a sheet's cache (full, paginated, etc.)
   */
  clearCache: (sheetName) => {
      try {
          const cache = CacheService.getScriptCache();
          // 1. Clear main key
          cache.remove(Utils.CACHE_PREFIX + `data_${sheetName}`);
          
          // 2. Clear common variations (heuristic)
          // We can't iterate keys in GAS, so we blindly remove likely candidates
          const variants = [0, 20, 50, 100, 200];
          variants.forEach(v => cache.remove(Utils.CACHE_PREFIX + `data_${sheetName}_${v}`));
          
          // 3. Clear Memory Cache
          if (Utils._memCache) Utils._memCache[sheetName] = null;
          
          // Utils.log("DEBUG", "Cache Cleared", { sheetName });
      } catch (e) {
          Utils.log("WARN", "Cache clear failed", { sheetName, error: e.toString() });
      }
  },

  CacheHelper: {
    get: (key) => {
      try { const v = CacheService.getScriptCache().get(Utils.CACHE_PREFIX + key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
    },
    put: (key, value, ttlSec) => {
      try { CacheService.getScriptCache().put(Utils.CACHE_PREFIX + key, JSON.stringify(value), ttlSec || 300); return true; } catch (e) { return false; }
    },
    remove: (key) => { try { CacheService.getScriptCache().remove(Utils.CACHE_PREFIX + key); return true; } catch (e) { return false; } }
  }
  ,

  /**
   * Optimized Data Fetcher: Reads ONLY specific columns.
   * Drastically faster for status checks (reading 5 cols vs 30).
   * @param {string} sheetName 
   * @param {string[]} requiredHeaders 
   * @returns {Object[]} Array of objects with only requested keys
   */
  getLiteData: (sheetName, requiredHeaders) => {
      const ss = Utils.getSS();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return [];
      
      const lastCol = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return [];

      // 1. Map Headers to Column Indices
      const allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(Utils.normalizeHeader);
      const colIndices = [];
      
      requiredHeaders.forEach(h => {
          const norm = Utils.normalizeHeader(h);
          const idx = allHeaders.indexOf(norm);
          if (idx > -1) colIndices.push({ key: h, idx: idx });
      });
      
      if (colIndices.length === 0) return [];

      // 2. Fetch ALL Data (Optimization: Fetch once, map in memory)
      
      const data = sheet.getDataRange().getValues();
      const result = [];
      
      for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const obj = {};
          colIndices.forEach(col => {
             obj[col.key] = row[col.idx]; 
          });
          // Add helpful metadata (row index)
          obj._rowIndex = i + 1;
          result.push(obj);
      }
      return result;
  },

  /**
   * Performance Monitoring Utility
   * Measures execution time and logs if exceeds threshold.
   */
  measure: (label, fn) => {
    const start = Date.now();
    try {
      return fn();
    } finally {
      const duration = Date.now() - start;
      if (duration > 1000) { // Log slow operations (>1s)
         Utils.log("WARN", `Slow Operation: ${label}`, { durationMs: duration });
      }
    }
  },

  retryWithBackoff: (fn, opts) => {
    opts = opts || {};
    const maxAttempts = opts.maxAttempts || 3;
    const baseDelay = opts.baseDelay || 500; // ms
    const jitter = opts.jitter || 200; // ms
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return fn();
      } catch (e) {
        attempt++;
        if (attempt >= maxAttempts) throw e;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * jitter);
        Utilities.sleep(delay);
      }
    }
  },

  /**
   * Standardize properties to snake_case
   */
  toSnakeCase: (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(Utils.toSnakeCase);
    
    const newObj = {};
    Object.keys(obj).forEach(key => {
      const newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
      newObj[newKey] = Utils.toSnakeCase(obj[key]);
    });
    return newObj;
  },

  /**
   * Standardize properties to camelCase
   */
  toCamelCase: (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(Utils.toCamelCase);

    const newObj = {};
    Object.keys(obj).forEach(key => {
      const newKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
      newObj[newKey] = Utils.toCamelCase(obj[key]);
    });
    return newObj;
  },

  /**
   * Get stored incremental stats
   */
  getStoredStats: () => {
    const props = PropertiesService.getScriptProperties();
    const stats = props.getProperty(Utils.STATS_KEY);
    if (stats) return JSON.parse(stats);
    return null;
  },

  /**
   * Save incremental stats
   */
  saveStoredStats: (stats) => {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(Utils.STATS_KEY, JSON.stringify(stats));
    // [FIX] Standardized to dashboard_stats to match Firebase listeners
    Firebase.update('dashboard_stats', stats);
  },

  /**
   * Helper: Get Driver Phone by ID
   * @param {string} driverId
   * @returns {string|null} Normalized phone or null
   */
  getDriverPhone: (driverId) => {
    if (!driverId) return null;
    try {
        const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id');
        const driver = driversMap.get(driverId);
        return driver ? Utils.normalizePhone(driver.phone) : null;
    } catch (e) {
        return null; 
    }
  },

  /**
   * MIGRATION: Ensure 'broadcast_msg_id' column exists in Orders sheet
   */
  ensureBroadcastColumn: () => {
      const sheet = Utils.getSS().getSheetByName(Schema.Sheets.ORDERS);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const normHeaders = headers.map(Utils.normalizeHeader);
      
      if (!normHeaders.includes('broadcastmsgid')) {
          sheet.getRange(1, headers.length + 1).setValue('broadcast_msg_id');
          Utils.log("AUDIT", "Migration", "Added broadcast_msg_id column to Orders sheet");
          return "Added broadcast_msg_id column";
      }
      return "Column already exists";
  },

  /**
   * Append row with retry logic to handle transient locking issues.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Array} row - Raw array of cell values
   * @param {number} retries - Number of retry attempts
   * @param {Object|null} rowObj - Optional: Full row as object for Firebase sync.
   *   Pass this when the caller knows the data shape (e.g. after building the full row object).
   *   If omitted, Firebase sync is skipped for this call.
   */
  appendRowWithRetry: (sheet, row, retries = 3, rowObj = null) => {
    for (let i = 0; i < retries; i++) {
        try {
            sheet.appendRow(row);

            // Firebase Dual-Write (non-blocking, only when rowObj is supplied)
            try {
              if (rowObj && ArchitectureSwitch.isEnabled('ENABLE_FIREBASE_SYNC')) {
                Firebase.syncSheetRow(sheet.getName(), rowObj);
              }
            } catch(fe) {
              // CRITICAL: Never allow Firebase errors to disrupt the main sheet operation
              Utils.log("WARN", "Firebase dual-write failed in appendRowWithRetry", { sheet: sheet.getName(), error: fe.toString() });
            }

            return true;
        } catch (e) {
            Utils.log('WARN', `AppendRow attempt ${i+1} failed`, e.toString());
            Utilities.sleep(Math.pow(2, i) * 100); // Exponential backoff starting at 100ms
        }
    }
    return false;
  },
  /**
   * migrateDateColumns: Fixes date formats in specified sheets/columns.
   * Converts various formats (like dd/MM/yyyy) to the canonical yyyy-MM-dd HH:mm:ss.
   */
  migrateDateColumns: (sheetNames) => {
    sheetNames = sheetNames || ['Orders', 'Drivers', 'Customers'];
    const ss = Utils.getSS();
    const results = {};
    try {
      sheetNames.forEach(name => {
        const sheet = ss.getSheetByName(name);
        if (!sheet) return;
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < 2) return;

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(Utils.normalizeHeader);
        const dateCols = [];
        headers.forEach((h, i) => {
          if (['created_at', 'updated_at', 'pickup_datetime', 'assigned_at', 'arrived_at', 'last_ride_date', 'consent_date', 'insurance_expiry', 'license_expiry', 'car_doc_expiry'].includes(h)) dateCols.push(i);
        });

        if (dateCols.length === 0) return;

        const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
        const data = range.getValues();
        let changed = 0;

        for (let r = 0; r < data.length; r++) {
          dateCols.forEach(colIdx => {
            const val = data[r][colIdx];
            if (val) {
              const d = Utils.parseDate(val);
              if (d) {
                const formatted = Utilities.formatDate(d, "Asia/Jerusalem", "yyyy-MM-dd HH:mm:ss");
                if (String(val) !== formatted) {
                  data[r][colIdx] = formatted;
                  changed++;
                }
              }
            }
          });
        }

        if (changed > 0) {
          range.setValues(data);
        }
        results[name] = { rows: data.length, fixes: changed };
      });
      return Utils.json({ ok: true, results });
    } catch (e) {
      return Utils.error('Date migration failed: ' + e.toString());
    }
  },

  /**
   * Verifies a Firebase ID Token using Google Identity Toolkit REST API
   * Implements CacheService to minimize external API calls and reduce latency
   */
  validateFirebaseTokenCached: (idToken, expectedType, settings) => {
    try {
      const cache = CacheService.getScriptCache();
      const tokenHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, idToken);
      const cacheKey = 'fb_auth_' + Utilities.base64Encode(tokenHash).substring(0, 16);
      
      const cachedPhone = cache.get(cacheKey + '_phone');
      if (cachedPhone) {
        return Utils.validatePhoneForType(cachedPhone, expectedType);
      }
      
      const apiKey = settings['FIREBASE_API_KEY'] || Utils.getSecret('FIREBASE_API_KEY');
      if (!apiKey) return false;
      
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) return false;

      const data = JSON.parse(response.getContentText());
      if (!data.users || data.users.length === 0) return false;
      
      const firebaseUser = data.users[0];
      const phoneNumber = firebaseUser.phoneNumber;
      if (!phoneNumber) return false;
      
      const localPhone = Utils.normalizePhone(phoneNumber);
      cache.put(cacheKey + '_phone', localPhone, 3000);
      
      return Utils.validatePhoneForType(localPhone, expectedType);
    } catch (e) {
      return false;
    }
  },

  /**
   * Validates if a normalized phone number exists in the database for a specific type
   */
  validatePhoneForType: (phone, type) => {
    const normalized = Utils.normalizePhone(phone);
    if (!normalized) return false;

    if (type === 'driver') {
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
      const driver = driversMap.get(normalized);
      return !!(driver && driver.status === 'ACTIVE');
    } else if (type === 'passenger') {
      const customersMap = Utils.getDataMap(Schema.Sheets.CUSTOMERS, 'customer_phone', { transformKey: k => Utils.normalizePhone(k) });
      return customersMap.has(normalized);
    } else if (type === 'admin') {
      const settings = SettingsService.getMap();
      const adminPhone = Utils.normalizePhone(settings['STATION_PAYMENT_PHONE'] || '');
      return normalized === adminPhone;
    }
    return false;
  }
};
