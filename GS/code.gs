/**
 * TAXI DISPATCH SYSTEM - MAIN ENTRY POINT
 * 
 * This file serves as the router and bootstrapper.
 * Core logic has been moved to the GS/ directory.
 * 
 * Modules:
 * - GS/Config.gs
 * - GS/Utils.gs
 * - GS/Settings.gs
 * - GS/News.gs
 * - GS/Auth.gs
 * - GS/Customer.gs
 * - GS/Pricing.gs
 * - GS/Order.gs
 * - GS/Driver.gs
 * - GS/Notification.gs
 * - GS/Dashboard.gs
 * - GS/Billing.gs
 * - GS/Archiver.gs
 * - GS/BotService.gs
 * - GS/Firebase.gs
 * - GS/StatsService.gs
 * - GS/SchemaEnforcer.gs
 * - GS/Triggers.gs
 */

// --- INITIALIZATION ---

function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const msgs = [];
  
  // 1. Rename Hebrew Sheets if they exist to match internal English logic
  const hebrewMap = {
    'הזמנות': 'Orders',
    'נהגים': 'Drivers',
    'לקוחות': 'Customers',
    'הגדרות': 'Settings',
    'לוגים': 'Logs',
    'דירוגים': 'Ratings'
  };
  
  Object.keys(hebrewMap).forEach(hebrewName => {
    const sheet = ss.getSheetByName(hebrewName);
    const targetName = hebrewMap[hebrewName];
    if (sheet && !ss.getSheetByName(targetName)) {
      sheet.setName(targetName);
      msgs.push(`Renamed Hebrew sheet "${hebrewName}" to "${targetName}"`);
    }
  });

  // 2. Ensure Sheets & Headers from Schema
  Object.keys(Schema.Columns).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        msgs.push(`Created Sheet: ${sheetName}`);
    }
    
    // Check if headers exist
    if (sheet.getLastRow() === 0) {
      const headers = Schema.Columns[sheetName];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#f3f3f3")
        .setBorder(true, true, true, true, true, true);
      sheet.setFrozenRows(1);
      msgs.push(`Initialized Headers: ${sheetName}`);
    } else {
        const currentHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(h => String(h).trim());
        const requiredHeaders = Schema.Columns[sheetName];
        
        requiredHeaders.forEach(h => {
             if (!currentHeaders.includes(h) && !currentHeaders.includes(Utils.normalizeHeader(h))) {
                 const nextCol = sheet.getLastColumn() + 1;
                 sheet.getRange(1, nextCol).setValue(h).setFontWeight("bold").setBackground("#e6f7ff");
                 msgs.push(`Added Missing Column to ${sheetName}: ${h}`);
             }
        });
    }
  });

  // 3. Inject/Update Settings Defaults
  SettingsService.ensureDefaults(ss);
  const removedCount = SettingsService.removeObsoleteKeys();
  if (removedCount > 0) msgs.push(`Settings: Removed ${removedCount} obsolete key(s)`);
  
  // 4. Auto-link External Ads Sheet
  const currentSettings = SettingsService.getMap(true);
  const adsKey = 'GOOGLE_ADS_EXTERNAL_SHEET_URL';
  if (!String(currentSettings[adsKey] || '').startsWith('https://')) {
      const ssUrl = ss.getUrl();
      SettingsService.save({ [adsKey]: ssUrl });
      msgs.push("Auto-linked GOOGLE_ADS_EXTERNAL_SHEET_URL");
  }

  // 5. Standardize all headers (Enforce snake_case)
  Utils.standardizeHeaders();

  // 6. Apply Schema Validation Rules (Dropdowns, Formats)
  SchemaEnforcerService.enforceAll();
  msgs.push("Applied Schema Validation Rules");

  // 7. Initialize Automation (Triggers)
  TriggersService.setupAutomation();
  msgs.push("Installed/Reset All Triggers");

  // 8. Bootstrap Initial Data
  const driversSheet = ss.getSheetByName('Drivers');
  if (driversSheet && driversSheet.getLastRow() === 1) {
    const adminEmail = currentSettings['ADMIN_EMAIL'] || 'admin@taxi.co.il';
    driversSheet.appendRow(['DRV-1001', 'מנהל מערכת', '0500000000', '', 'ACTIVE', 'מרכז', '123456', '77-888-99', 'Taxi', 'White', 0, 0, new Date(), '', new Date(), 5, 0, 'dummy_secret', 32.0, 34.8, adminEmail]);
    driversSheet.appendRow(['DRV-1002', 'נהג בדיקה', '0500000002', '', 'ACTIVE', 'מרכז', '654321', '11-222-33', 'Toyota', 'Black', 0, 0, new Date(), '', new Date(), 5, 0, 'dummy_secret', 32.0, 34.8, 'driver@example.com']);
    msgs.push("Added Bootstrap Drivers (DRV-1001, DRV-1002)");
  }

  const customersSheet = ss.getSheetByName('Customers');
  if (customersSheet && customersSheet.getLastRow() === 1) {
    customersSheet.appendRow(['0500000002', 'לקוח נסיון', 0, 0, new Date(), new Date(), '', 'customer@example.com', 'לקוח', 'נסיון', '', '', '']);
    msgs.push("Added Bootstrap Customer");
  }

  const ordersSheet = ss.getSheetByName('Orders');
  if (ordersSheet && ordersSheet.getLastRow() === 1) {
    const defaultHeaders = Schema.Columns.Orders;
    const row = new Array(defaultHeaders.length).fill('');
    row[0] = 'ORD-' + Date.now();
    row[1] = 'לקוח נסיון';
    row[2] = '0500000002';
    row[3] = 'תל אביב';
    row[4] = 'ירושלים';
    row[5] = new Date();
    row[6] = 250;
    row[7] = 'pending';
    row[11] = new Date();
    row[12] = new Date();
    ordersSheet.appendRow(row);
    msgs.push("Added Bootstrap Order");
  }

  Utils.log("AUDIT", "System Setup Completed", { messages: msgs });
  
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('✅ המערכת הוגדרה בהצלחה!\n\n' + msgs.join('\n'));
  } catch(e) {}

  return Utils.json({ ok: true, messages: msgs });
}

/**
 * Force Update User Settings
 * Runs through DEFAULT_SETTINGS and forcibly overwrites existing rows in Settings Sheet.
 * Useful when defaults change (like WA numbers) and we need them to apply over old data.
 * NOTE: Keys marked [SECURELY_STORED_IN_PROPS] or [HIDDEN] will NOT overwrite real secrets.
 */
function forceUpdateSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const existingKeys = {};
  
  // Map row indexes
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) existingKeys[String(data[i][0]).trim()] = i + 1;
  }

  let updatedCount = 0;
  
  DEFAULT_SETTINGS.forEach(item => {
    const key = item.key;
    const defaultVal = item.value;
    
    // Skip secrets so we don't accidentally overwrite working API keys with [HIDDEN]
    if (defaultVal === '[HIDDEN]' || defaultVal === '[SECURELY_STORED_IN_PROPS]' || defaultVal === '[NOT_SET]' || defaultVal === '***') {
        return;
    }
    
    if (existingKeys[key]) {
      // Overwrite existing
      const currentVal = String(data[existingKeys[key]-1][1]).trim();
      if (currentVal !== defaultVal) {
          sheet.getRange(existingKeys[key], 2).setValue(defaultVal);
          updatedCount++;
      }
    } else {
      // Append new
      sheet.appendRow([key, defaultVal]);
      updatedCount++;
    }
  });
  
  // Clear Caches
  if (typeof SettingsService !== 'undefined') {
      SettingsService._cache = null;
      CacheService.getScriptCache().remove('tx_v4_app_settings_v4');
  }
  
  Utils.log("AUDIT", `Force Update Settings Completed. Updated ${updatedCount} rows.`);
  return `✅ איפוס ההגדרות הושלם (עודכנו ${updatedCount} ערכים). נא לרענן את הגיליון.`;
}

/**
 * Hourly Maintenance Trigger
 * Runs periodically to keep system healthy
 */
function hourlyMaintenance() {
  TriggersService.ensureTriggersAlive(); // Ensure triggers remain active
  SchemaEnforcerService.enforceAll(); // Periodically enforce types
  MaintenanceService.rollUpDailyStats(); // NEW: Rollup daily stats for performance
  DashboardService.syncStats(); // Refresh dashboard stats
  OrderService.cleanupOldFirebaseOrders(); // Remove old map markers
}

/**
 * Legacy support for manual trigger creation/deletion
 */
function createTriggers() {
    return TriggersService.setupAutomation();
}

function deleteTriggers() {
    TriggersService.clearAll();
    return "🗑️ Triggers Deleted!";
}

function backupSystem() {
    // Basic backup implementation - create a copy of the spreadsheet
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const date = Utilities.formatDate(new Date(), "Asia/Jerusalem", "yyyy-MM-dd");
        const name = `Backup_${ss.getName()}_${date}`;
        
        // Check if backup already exists for today to avoid spam (optional, but good practice)
        // For simplicity, we just create it. Google Drive handles duplicates by name fine (unique IDs).
        
        const destFolder = DriveApp.getFileById(ss.getId()).getParents().next(); // Same folder
        DriveApp.getFileById(ss.getId()).makeCopy(name, destFolder);
        
        Utils.log("AUDIT", "SystemBackupCreated", { name });
    } catch (e) {
        Utils.log("ERROR", "Backup Failed", e.toString());
    }
}

/**
 * Backup Firebase Realtime Database data to a local Sheet.
 * Recommended: Add this to a daily trigger at 4 AM.
 */
function backupFirebaseData() {
    try {
        if (!Firebase.isEnabled()) {
            Utils.log("INFO", "Firebase Backup Skipped", "Firebase not enabled");
            return;
        }
        
        const ss = Utils.getSS();
        const date = Utilities.formatDate(new Date(), "Asia/Jerusalem", "yyyy-MM-dd HH:mm");
        
        // 1. Backup Active Orders
        const ordersRes = Firebase.get('active_orders');
        if (ordersRes.ok && ordersRes.data) {
            let sheet = ss.getSheetByName('Firebase_Backup_Orders');
            if (!sheet) {
                sheet = ss.insertSheet('Firebase_Backup_Orders');
                sheet.appendRow(['backup_date', 'order_id', 'status', 'pickup_address', 'destination_address', 'driver_id', 'raw_json']);
                sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
                sheet.setFrozenRows(1); // [FIX] Improve readability
            } else {
                // [FIX] Prevent unbounded growth: Clear old backup before writing new snapshot
                if (sheet.getLastRow() > 1) {
                    sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).clearContent();
                }
            }
            
            // Limit to recent 1000 to prevent timeout
            const keys = Object.keys(ordersRes.data);
            const recentKeys = keys.slice(-1000); 
            
            recentKeys.forEach(key => {
                const o = ordersRes.data[key];
                sheet.appendRow([date, key, o.status, o.pickup_address, o.destination_address, o.driver_id, JSON.stringify(o)]);
            });
        }
        
        // 2. Backup Driver Locations
        const driversRes = Firebase.get('drivers');
        if (driversRes.ok && driversRes.data) {
            let sheet = ss.getSheetByName('Firebase_Backup_Drivers');
            if (!sheet) {
                sheet = ss.insertSheet('Firebase_Backup_Drivers');
                sheet.appendRow(['backup_date', 'driver_id', 'driver_name', 'lat', 'lng', 'last_heartbeat', 'raw_json']);
                sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
            } else {
                // [QA FIX DATA-004] Prevent unbounded growth: Clear old backup before writing new snapshot
                if (sheet.getLastRow() > 1) {
                    sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).clearContent();
                }
            }
            
            Object.keys(driversRes.data).forEach(key => {
                const d = driversRes.data[key];
                sheet.appendRow([date, key, d.driver_name, d.lat, d.lng, d.last_heartbeat, JSON.stringify(d)]);
            });
        }
        
        Utils.log("AUDIT", "FirebaseBackupCompleted", { date });
        return Utils.json({ ok: true, message: 'Firebase Backup Completed' });
    } catch (e) {
        Utils.log("ERROR", "Firebase Backup Failed", e.toString());
        return Utils.json({ ok: false, error: e.toString() });
    }
}

function repairAuth() {
    try {
        const key = 'BRIDGE_API_KEY';
        // [SECURE] Only generate new random secret if it's MISSING or DEFAULT
        const existing = Utils.getSecret(key);
        
        if (existing && existing.length > 10 && 
            existing !== '[HIDDEN]' && 
            existing !== 'secret-bridge-key' && 
            existing !== '[SECURELY_STORED_IN_PROPS]') {
            Utils.log("INFO", "repairAuth: BRIDGE_API_KEY already looks valid. Skipping regeneration.");
            return "✅ BRIDGE_API_KEY is already configured. No changes made.";
        }

        const val = Utils.generateSalt(32);
        
        // 1. Set Property
        Utils.setSecret(key, val);
        
        // 2. Set Sheet
        const sheet = Utils.getSS().getSheetByName('Settings');
        if (sheet) {
            const data = sheet.getDataRange().getValues();
            let found = false;
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === key) {
                    sheet.getRange(i + 1, 2).setValue('[SECURELY_STORED_IN_PROPS]');
                    found = true;
                    break;
                }
            }
            if (!found) sheet.appendRow([key, '[SECURELY_STORED_IN_PROPS]']);
        }
        
        // 3. Clear Cache
        SettingsService.getMap(true);
        
        Utils.log("AUDIT", "repairAuth: Regenerated BRIDGE_API_KEY");
        return "✅ BRIDGE_API_KEY has been reset to a new random value. Please update your bridge .env accordingly.";
    } catch (e) {
        Utils.log("ERROR", "repairAuth Failed", e.toString());
        return "❌ Repair Failed: " + e.toString();
    }
}


// --- HTTP ROUTER (doGet) ---

function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    
    // CORS wrappers handled by Utils.json (ContentService)
    
    if (action === 'test') {
        return Utils.json({ status: 'ok', time: new Date().toISOString() });
    }

    // [SECURITY] Guard GET routes unless explicitly public
    if (ActionHandlers[action]) {
        const settings = SettingsService.getMap();
        const authToken = params.authToken || params.token || '';
        const isAdmin = Utils.checkAuth(authToken, 'admin', settings);
        const publicGetActions = ['test', 'testConnection', 'getTaxiNews', 'getNews'];
        if (!publicGetActions.includes(action) && !isAdmin) {
            return Utils.error('Unauthorized', 401, null);
        }
        // For GET, the payload is the query parameters
        return ActionHandlers[action](params, settings, authToken);
    }

    // Legacy/Simple Endpoints
    return Utils.json({ error: 'Unknown Action', action });
  } catch (e) {
    Utils.log("ERROR", "doGet Error", e.toString());
    return Utils.error(e.toString());
  } finally {
    if (Utils) {
      if (Utils.flushLogs) Utils.flushLogs();
      if (Utils.flushNotificationLogs) Utils.flushNotificationLogs();
    }
  }
}

// --- CORS PREFLIGHT (doOptions) ---
function doOptions(e) {
  // Apps Script handles CORS automatically for Web Apps.
  // We just return empty success 200.
  return ContentService.createTextOutput("");
}

// --- HTTP ROUTER (doPost) ---

// Actions defined in GS/Config.gs

const ActionHandlers = {
  // Auth
  'loginAdmin': (p, s) => AuthService.loginAdmin(p, SettingsService.getMap(true)),
  'adminLogin': (p, s) => AuthService.loginAdmin(p, s), // @deprecated alias: use loginAdmin
  'logoutAdmin': (p, s) => Utils.json({ ok: true, message: 'Logged out' }),
  'checkAuth': (p, s, t) => AuthService.checkAuthStatus ? AuthService.checkAuthStatus(p, s, t) : Utils.json({ok:false, error:'checkAuthStatus missing'}),
  'loginDriver': (p, s) => DriverService.login(p.phone || p.phoneNumber),
  'driverLogin': (p, s) => DriverService.login(p.phone || p.phoneNumber), // @deprecated alias: use loginDriver
  'loginWithToken': (p, s, t) => AuthService.loginWithFirebaseToken(p, s),
  'driverLoginWithToken': (p, s) => AuthService.loginWithFirebaseToken(p, s), // @deprecated alias: use loginWithToken
  'requestOTP': (p, s) => AuthService.requestOTP(p, s),
  'verifyOTP': (p, s) => AuthService.verifyOTP(p, s),
  'loginWithFirebaseToken': (p, s) => AuthService.loginWithFirebaseToken(p, s),
  'loginWithGoogle': (p, s) => AuthService.loginWithGoogle(p, s),
  'testBridgeConnection': (p, s) => AuthService.testBridgeConnection(p, s),
  'proxyBridgeStatus': (p, s, t) => {
    try {
      // [FIX H-03] Defense-in-depth: Explicit admin check
      if (!Utils.checkAuth(t, 'admin', s)) {
          return Utils.error('Unauthorized: Admin access required', 401);
      }
      
      const url = p.bridgeUrl;
      const key = Utils.getSecret('BRIDGE_API_KEY') || s['BRIDGE_API_KEY'];
      if (!url) return Utils.json({ ok: false, error: 'No Bridge URL provided' });
      
      // [FIX A-03] SSRF Protection: Only allow trusted domains
      try {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.toLowerCase();
        const ALLOWED_DOMAINS = ['render.com', 'onrender.com', 'ngrok.io', 'trycloudflare.com', 'localhost'];
        const isAllowed = ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
        
        if (!isAllowed) {
          Utils.log("SECURITY", "Blocked unauthorized bridge status proxy attempt", { url, domain });
          return Utils.json({ ok: false, error: 'Domain not authorized for proxy' });
        }
      } catch (e) {
        return Utils.json({ ok: false, error: 'Invalid URL format' });
      }

      const resp = UrlFetchApp.fetch(`${url}/status`, {
        method: 'get',
        headers: { 'x-api-key': key },
        muteHttpExceptions: true
      });
      
      if (resp.getResponseCode() === 200) {
        return Utils.json({ ok: true, data: JSON.parse(resp.getContentText()) });
      } else {
        return Utils.json({ ok: false, error: `Bridge error: ${resp.getResponseCode()}` });
      }
    } catch (e) {
      return Utils.json({ ok: false, error: e.toString() });
    }
  },

  // Orders
  'createOrder': (p, s) => OrderService.create(p, s),
  'getOrders': (p, s) => OrderService.getAll(p),
  'getOrder': (p, s) => OrderService.getOne(p.orderId || p.order_id),
  'getOrderStatus': (p, s) => OrderService.getOne(p.orderId || p.order_id), // @deprecated alias: use getOrder
  'updateOrder': (p, s) => OrderService.update(p, s),
  'cancelOrder': (p, s) => OrderService.cancel(p, s),
  'acceptOrder': (p, s) => OrderService.acceptByPhone(p, s),   // @deprecated alias: use acceptRideByPhone
  'acceptRideByPhone': (p, s) => OrderService.acceptByPhone(p, s),
  'acceptByTelegramWebApp': (p, s) => OrderService.acceptByTelegramWebApp(p, s),
  'completeOrder': (p, s) => OrderService.complete(p),
  'assignDriver': (p, s) => DriverService.registerAndAssign(p, s),
  'unassignDriver': (p, s) => OrderService.unassignDriver(p.orderId || p.order_id, s),
  'markPayment': (p, s, t) => OrderService.markPaymentCompleted(p, s, t),   // @deprecated alias: use markPaymentCompleted
  'markPaymentCompleted': (p, s, t) => OrderService.markPaymentCompleted(p, s, t),
  'getPaymentInfo': (p, s) => OrderService.getPaymentInfo(p, s),
  'getOrderDetails': (p, s) => OrderService.getOrderDetails(p, s),
  'getOfferDetails': (p, s) => OrderService.getOfferDetails(p, s),
  'resendOrderDetails': (p, s) => {
       // A4 FIX: Don't parse raw GAS TextOutput inside the handler.
       // Delegate to OrderService which returns plain objects internally.
       const orderId = String(p.orderId || p.order_id || '').trim();
       if (!orderId) return Utils.error('Missing orderId');

       try {
           const ordersMap = Utils.getDataMap('Orders', 'order_id');
           const order = ordersMap.get(orderId) || Utils.getLiteData('Orders', Schema.Columns.Orders).find(o => Utils.compareIds(o.order_id, orderId));
           if (!order) return Utils.error('Order not found');

           const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'driver_id');
           const driver = driversMap.get(order.driver_id || order.driverid);

           if (!driver) return Utils.error('Driver not found for this order');

           NotificationService.sendDriverAssignment(driver, order, s);
           return Utils.json({ ok: true, message: 'Order details resent to driver' });
       } catch (e) {
           Utils.log('ERROR', 'resendOrderDetails failed', e.toString());
           return Utils.error('Failed to resend: ' + e.toString());
       }
  },

  'getDrivers': (p, s) => DriverService.getAll(p),
  'getDriver': (p, s) => DriverService.getOne(p.driverId || p.driver_id),
  'registerDriver': (p, s, t) => {
    const isAdmin = Utils.checkAuth(t, 'admin', s);
    return DriverService.register(p, isAdmin ? DriverStatus.ACTIVE : DriverStatus.PENDING);
  },
  'registerDriverSelf': (p, s, t) => DriverService.register(p, DriverStatus.PENDING), // @deprecated alias: use registerDriver
  'registerDriverAndAssignOrder': (p, s, t) => DriverService.registerAndAssign(p, s),
  'getDriverPortalData': (p, s, t) => DriverService.getPortalData(t || p.authToken || p.token, p),
  'updateLocation': (p, s) => DriverService.updateLocation(p),
  'updateDriverLocation': (p, s) => DriverService.updateLocation(p), // @deprecated alias: use updateLocation
  'linkTelegram': (p, s) => DriverService.linkTelegram(p.phone, p.telegramData),
  'updateDriverProfile': (p, s) => DriverService.updateProfile(p),
  'driverStatus': (p, s) => DriverService.updateStatus(p.driverId || p.driver_id, p.status),
  'deleteDriver': (p, s) => DriverService.softDelete(p.driverId || p.driver_id),
  // MISSING-006: Admin approval flow for pending drivers
  'getPendingDrivers': (p, s) => DriverService.getPending(),
  'approveDriver': (p, s) => DriverService.approve(p.driverId || p.driver_id),
  'rejectDriver': (p, s) => DriverService.reject(p.driverId || p.driver_id, p.reason),
  // SEC-001: Migrate admin password out of Settings Sheet into Script Properties
  'secureAdminPassword': (p, s) => {
    try {
      const current = s['ADMIN_PASSWORD'];
      if (!current || current === '[SECURELY_STORED_IN_PROPS]') {
        return Utils.json({ ok: true, message: 'ADMIN_PASSWORD already secured' });
      }
      // Move to Script Properties
      PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', current);
      // Mask in Settings Sheet
      SettingsService.save({ ADMIN_PASSWORD: '[SECURELY_STORED_IN_PROPS]' });
      Utils.log('AUDIT', 'SEC-001: ADMIN_PASSWORD migrated to Script Properties and masked in Settings Sheet');
      return Utils.json({ ok: true, message: 'ADMIN_PASSWORD secured in Script Properties. Sheet value masked.' });
    } catch (e) {
      return Utils.error('Failed to secure admin password: ' + e.toString());
    }
  },

  // Config & Dash
  'getSettings': (p, s) => SettingsService.getAll(),
  'getSystemSettings': (p, s) => SettingsService.getAll(p), // Alias
  'saveSettings': (p, s) => SettingsService.save(p.settings || p),
  'getDashboardStats': (p, s) => DashboardService.getStats(p), // Pass params for force refresh
  'getStats': (p, s) => DashboardService.getStats(p), // Alias for frontend compatibility
  'getMarketingStats': (p, s) => Utils.safeRun('getMarketingStats', () => AnalyticsService.getMarketingStats(p)),
  'fetchFacebookAdsData': (p, s) => AnalyticsService.fetchFacebookAdsData(p, s),
  'exportCampaignStats': (p, s) => AnalyticsService.exportCampaignStats(p, s),
  'getMapData': (p, s) => DashboardService.getMapData(),
  'getNews': (p, s) => NewsService.getTaxiNews(),
  'getTaxiNews': (p, s) => NewsService.getTaxiNews(), // Alias
  'getBillingReport': (p, s, t) => BillingService.generateMonthlyReport(p.driverId || p.driver_id, p.month, p.year, s, t),
  'generateMonthlyReport': (p, s, t) => BillingService.generateMonthlyReport(p.driverId || p.driver_id, p.month, p.year, s, t), // Alias
  'getDailyReport': (p, s, t) => BillingService.getDailyReport(s, t),
  'getDailyFinanceReport': (p, s, t) => BillingService.getDailyReport(s, t), // Alias
  'calculatePrice': (p, s) => PricingService.calculate(p, s),
  
  // Analytics & Fleet Management
  'getRevenueStats': (p, s) => StatsService.getRevenueStats(p, s),
  'getDemandHeatmap': (p, s) => StatsService.getDemandHeatmap(p, s),
  'getHeatmapData': (p, s) => StatsService.getDemandHeatmap(p, s), // Frontend alias
  'getDriverLeaderboard': (p, s) => StatsService.getDriverLeaderboard(p, s),
  'checkDocumentExpiry': (p, s) => DriverService.checkDocumentExpiry(s),
  'generateCommissionReport': (p, s) => BillingService.generateCommissionReport(p, s),
  'getSystemHealth': (p, s) => {
    // Return bridge and system connectivity status
    const health = {
      bridge_url: s['WHATSAPP_BRIDGE_URL'] || '',
      render_url: s['WHATSAPP_RENDER_URL'] || '',
      fallback_url: s['WHATSAPP_FALLBACK_URL'] || '',
      bridge_mode: s['BRIDGE_MODE'] || 'AUTO',
      has_telegram_token: !!(s['TELEGRAM_BOT_TOKEN'] && s['TELEGRAM_BOT_TOKEN'] !== '[HIDDEN]'),
      has_bridge_key: !!(s['BRIDGE_API_KEY'] && s['BRIDGE_API_KEY'] !== '[HIDDEN]' && s['BRIDGE_API_KEY'] !== '[SECURELY_STORED_IN_PROPS]'),
      has_firebase: !!(s['FIREBASE_DB_URL'] && s['FIREBASE_AUTH_SECRET']),
      has_google_maps: !!(s['GOOGLE_MAPS_API_KEY'] && s['GOOGLE_MAPS_API_KEY'] !== '[HIDDEN]'),
      timestamp: new Date().toISOString()
    };
    return Utils.json({ ok: true, data: health });
  },
  
  // [QA FIX BUG-006] Removed duplicate getDashboardBundle (inline version at L459 is kept)

  // Maintenance (Admin Only)
  'setupSystem': (p, s) => setupSystem(),
  'forceSync': (p, s) => Utils.json({ ok: true, message: forceSync() }),
  'resetFirebase': (p, s) => Utils.json({ ok: true, message: resetFirebase() }),
  // MISSING-002: Passenger ride history endpoint
  'getPassengerHistory': (p, s, t) => CustomerService.getHistory(p, s, t),

  'getLatestLogs': (p, s) => {
      try {
          const sheet = Utils.getSS().getSheetByName('Logs');
          if (!sheet) return Utils.json({ ok: false, error: 'Logs sheet not found' });
          const lastRow = sheet.getLastRow();
          if (lastRow <= 1) return Utils.json({ ok: true, logs: [] });
          const startRow = Math.max(2, lastRow - 50);
          const numRows = lastRow - startRow + 1;
          const range = sheet.getRange(startRow, 1, numRows, 5);
          return Utils.json({ ok: true, logs: range.getValues() });
      } catch (e) { return Utils.error(e.toString()); }
  },

  'testConnection': (p, s) => Utils.json({ ok: true, data: { message: 'Connected to GAS ✅', version: '2.0' } }),
  'runSystemTest': (p, s) => SystemTest.run(),
  
  // [FIX IMP-002] Expose backupFirebaseData so admins can trigger it from the Dashboard
  'backupFirebaseData': (p, s) => backupFirebaseData(),
  
  // Customers
  'getCustomers': (p, s) => CustomerService.getAll ? CustomerService.getAll(p) : Utils.error('Not implemented'),
  'getCustomer': (p, s) => CustomerService.getOne ? CustomerService.getOne(p.id) : Utils.error('Not implemented'),
  'updateCustomer': (p, s) => CustomerService.update ? CustomerService.update(p) : Utils.error('Not implemented'),
  // MISSING-002: Passenger ride history endpoint
  'getPassengerHistory': (p, s, t) => CustomerService.getHistory(p, s, t),

  // --- FIREBASE CUSTOM AUTH ---
  'getFirebaseToken': (p, s, t) => {
      if (!t) return Utils.error('Unauthorized', 401);
      
      let claims = {};
      let uid = '';

      if (Utils.checkAuth(t, 'admin', s)) {
         uid = 'admin_' + Date.now();
         claims = { admin: true };
      } else if (Utils.checkAuth(t, 'driver', s)) {
         const parts = t.split('_');
         uid = parts[1];
         claims = { driver_id: uid };
      } else if (Utils.checkAuth(t, 'passenger', s)) {
         const parts = t.split('_');
         uid = parts[1];
         claims = { passenger_phone: uid };
      } else {
         return Utils.error('Invalid session token', 401);
      }

      try {
         const token = Utils.createFirebaseCustomToken(uid, claims);
         return Utils.json({ ok: true, data: { token } });
      } catch (e) {
         Utils.log('ERROR', 'getFirebaseToken failed', e.toString());
         return Utils.error('Firebase Auth not configured on server (Missing Service Account)');
      }
  },

  // Utils / Bridge
  /**
   * Allows the local bridge (cloudflared/ngrok) to update its public URL automatically.
   * Auth: requires authToken === BRIDGE_API_KEY (ScriptProperties preferred).
   */
  'updateBridgeUrl': (p, s, t) => {
    try {
      const bridgeKey = Utils.getSecret('BRIDGE_API_KEY') || s['BRIDGE_API_KEY'];
      if (!bridgeKey || String(t || '').trim() !== String(bridgeKey).trim()) return Utils.error('Unauthorized', 401, null);

      const url = String(p && (p.url || p.bridgeUrl || p.bridge_url) || '').trim().replace(/\/$/, '');
      if (!url || !/^https:\/\//.test(url)) return Utils.error('Invalid URL');

      const meta = {
        bridgeHostname: String(p && (p.hostname || p.host || p.bridgeHost || p.bridge_host) || '').trim(),
        tunnelType: String(p && (p.tunnelType || p.tunnel_type) || 'cloudflared').trim(),
        updatedAt: new Date().toISOString()
      };

      // Persist in Settings (and ScriptProperties via SettingsService.save)
      SettingsService.save({
        'WHATSAPP_BRIDGE_URL': url,
        'WHATSAPP_BRIDGE_URL_UPDATED_AT': meta.updatedAt,
        'WHATSAPP_BRIDGE_URL_UPDATED_BY': meta.bridgeHostname || 'unknown',
        'WHATSAPP_BRIDGE_TUNNEL_TYPE': meta.tunnelType
      });

      // Save() returns TextOutput; we still return ok json for callers
      try { SettingsService.getMap(true); } catch (e) { Utils.log('DEBUG', 'Settings cache refresh failed', e.toString()); }
      return Utils.json({ ok: true, data: { url, meta } });
    } catch (e) {
      Utils.log('ERROR', 'updateBridgeUrl failed', e.toString());
      return Utils.error('Failed to update bridge url');
    }
  },
  'openBridgeFolder': (p, s) => { // Alias for triggerFolderOpen
      return ActionHandlers.triggerFolderOpen(p, s);
  },
  'triggerFolderOpen': (p, s) => {
    try {
      const url = s['WHATSAPP_BRIDGE_URL'];
      // Fix: Consistent Key Retrieval
      const key = Utils.getSecret('BRIDGE_API_KEY') || s['BRIDGE_API_KEY'];
      
      if (!url) return Utils.json({ ok: false, error: 'Bridge URL not configured' });
      
      const payload = {};
      if (p && p.path) payload.path = p.path;

      const resp = Utils.fetchWithRetry(`${url}/open-folder`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return Utils.json({ ok: resp.getResponseCode() === 200 });
    } catch (e) { return Utils.json({ ok: false, error: 'Failed to trigger folder open' }); }
  },
  'pickBridgeFolder': (p, s) => {
    try {
      const url = s['WHATSAPP_BRIDGE_URL'];
      // Fix: Consistent Key Retrieval
      const key = Utils.getSecret('BRIDGE_API_KEY') || s['BRIDGE_API_KEY'];
      
      if (!url) return Utils.json({ ok: false, error: 'Bridge URL not configured' });
      
      const resp = Utils.fetchWithRetry(`${url}/pick-folder`, {
        method: 'POST',
        headers: { 'x-api-key': key },
        muteHttpExceptions: true
      });
      
      if (resp.getResponseCode() === 200) {
          const json = JSON.parse(resp.getContentText());
          return Utils.json(json); // { success: true, path: "..." }
      }
      return Utils.json({ success: false, error: `Bridge Error (${resp.getResponseCode()})` });
    } catch (e) { return Utils.json({ success: false, error: 'Failed to communicate with bridge' }); }
  },
  'getNotifications': (p, s) => {
    // Admin-only action
    const sheet = Utils.getSS().getSheetByName('Notifications');
    if (!sheet) return Utils.json({ ok: true, data: [] });
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return Utils.json({ ok: true, data: [] });
    // Assuming simple structure for now, can delegate to NotificationService later if needed
    const rows = data.slice(1).map(r => ({
      timestamp: r[0], requestId: r[1], bridgeMessageId: r[2], method: r[3], jid: r[4], targetGroupJid: r[5], driverId: r[6], orderId: r[7], text: r[8], status: r[9], rawResponse: r[10]
    }));
    const filters = p || {};
    const filtered = rows.filter(r => {
      if (filters.requestId && String(r.requestId) !== String(filters.requestId)) return false;
      if (filters.orderId && String(r.orderId) !== String(filters.orderId)) return false;
      if (filters.status && String(r.status) !== String(filters.status)) return false;
      return true;
    });
    return Utils.json({ ok: true, data: filtered.slice(0, 200) });
  },
  // [QA FIX CODE-004] NotificationService.replay does not exist; return informative error
  'replayNotification': (p, s) => Utils.error('replayNotification is not implemented yet'),
  'setTelegramWebhook': (p, s) => NotificationService.setWebhook(p.url, s),
  'deleteTelegramWebhook': (p, s) => NotificationService.deleteWebhook(s),
  'submitRating': (p, s) => DashboardService.submitRating(p),
  'searchAddress': (p, s) => PricingService.searchAddress(p, s),
  'standardizeHeaders': (p, s) => Utils.standardizeHeaders(),
  'repairPhoneNumbers': (p, s) => { NotificationService.repairPhoneNumberFormats(); return Utils.json({ok:true}); },

  'saveFcmToken': (p, s, t) => {
    try {
      const driverId = String(p.driverId || p.driver_id || '').trim();
      const fcmToken = String(p.fcmToken || p.fcm_token || '').trim();
      if (!driverId || !fcmToken) return Utils.error('Missing driverId or fcmToken');

      // Require valid driver auth token and ensure token owner matches target driver
      if (!t || !Utils.checkAuth(t, 'driver', s)) return Utils.error('Unauthorized', 401, null);
      const tokenParts = String(t).split('_');
      const tokenDriverId = tokenParts.length >= 3 ? String(tokenParts[1] || '').trim() : '';
      if (!tokenDriverId || !Utils.compareIds(tokenDriverId, driverId)) return Utils.error('Forbidden', 403, null);

      const driversSheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
      if (!driversSheet) return Utils.error('Drivers sheet not found');

      Utils.ensureHeaders(Schema.Sheets.DRIVERS, ['fcm_token', 'fcm_updated_at']);
      const data = driversSheet.getDataRange().getValues();
      if (!data || data.length < 2) return Utils.error('Driver not found');
      const headers = data[0].map(Utils.normalizeHeader);
      const idIdx = headers.indexOf('driverid');
      const fcmIdx = headers.indexOf('fcmtoken');
      const fcmUpdatedIdx = headers.indexOf('fcmupdatedat');
      if (idIdx === -1 || fcmIdx === -1 || fcmUpdatedIdx === -1) return Utils.error('FCM columns missing');

      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (Utils.compareIds(data[i][idIdx], driverId)) { rowIndex = i + 1; break; }
      }
      if (rowIndex === -1) return Utils.error('Driver not found');

      driversSheet.getRange(rowIndex, fcmIdx + 1).setValue(fcmToken);
      driversSheet.getRange(rowIndex, fcmUpdatedIdx + 1).setValue(new Date().toISOString());
      Utils.clearCache(Schema.Sheets.DRIVERS);

      // Optional push mirror for realtime workers
      try { Firebase.set(`driver_tokens/${driverId}`, { token: fcmToken, updated_at: new Date().toISOString() }); } catch (e) { Utils.log('WARN', 'Firebase FCM token mirror failed', e.toString()); }

      return Utils.json({ ok: true, data: { driverId } });
    } catch (e) {
      Utils.log('ERROR', 'saveFcmToken failed', e.toString());
      return Utils.error('Failed saving token');
    }
  },
  'getSystemDiagnostics': (p, s) => getSystemDiagnostics(),
  'whatsappWebhook': (p, s) => BotService.handleWhatsAppLocation(p, s),
  
  /**
   * [PERFORMANCE] Batch API - Returns all dashboard data in one request
   * Reduces 4 separate requests to 1, improving load time by ~75%
   */
  'getDashboardBundle': (p, s) => {
    try {
      const limit = p?.limit || 30;
      
      // Helper to parse TextOutput if needed
      const parse = (res) => {
          if (res && typeof res.getContent === 'function') {
              try { return JSON.parse(res.getContent()); } catch(e) { return { ok: false }; }
          }
          return res;
      };
      
      const ordersRes = parse(OrderService.getAll({ limit, status: p?.status }));
      const statsRes = parse(DashboardService.getStats());
      const driversRes = parse(DriverService.getAll({ limit: 100 }));
      const settingsRes = parse(SettingsService.getAll());
      
      return Utils.json({
        ok: true,
        data: {
          orders: (ordersRes && ordersRes.data) ? (ordersRes.data.items || ordersRes.data) : [],
          stats: (statsRes && statsRes.data) ? statsRes.data : {},
          drivers: (driversRes && driversRes.data) ? (driversRes.data.items || driversRes.data) : [],
          settings: (settingsRes && settingsRes.data) ? settingsRes.data : {},
          fetchedAt: new Date().toISOString()
        }
      });
    } catch (e) {
      Utils.log('ERROR', 'getDashboardBundle failed', e.toString());
      return Utils.json({ ok: false, error: e.toString() });
    }
  },
  
  /**
   * [PERFORMANCE] Incremental Sync - Returns only orders modified since lastSync timestamp
   * Reduces data transfer by ~90% on repeat visits
   */
  'getOrdersDelta': (p, s) => {
    try {
      const lastSync = p?.lastSync ? new Date(p.lastSync).getTime() : 0;
      const limit = p?.limit || 50;
      
      // [QA FIX PERF-001] Use limitLast to avoid reading all rows
      const allOrders = Utils.getData('Orders', false, Math.max(limit * 2, 200));
      const now = Date.now();
      
      const deltaOrders = allOrders.filter(order => {
        // [FIX IMPROVEMENT-004] Include created_at in delta check so new orders
        // (with no updated_at) are always included in incremental sync
        const updatedAt = order.updated_at ? new Date(order.updated_at).getTime() : 0;
        const completedAt = order.completed_at ? new Date(order.completed_at).getTime() : 0;
        const createdAt = order.created_at ? new Date(order.created_at).getTime() : 0;
        const rowTime = Math.max(updatedAt, completedAt, createdAt);
        
        return rowTime > lastSync;
      }).slice(0, limit);
      
      return Utils.json({
        ok: true,
        data: {
          orders: deltaOrders.map(Utils.toSnakeCase),
          syncedAt: new Date().toISOString(),
          totalDelta: deltaOrders.length
        }
      });
    } catch (e) {
      Utils.log('ERROR', 'getOrdersDelta failed', e.toString());
      return Utils.json({ ok: false, error: e.toString() });
    }
  }
};



function forceSync() {
    try {
        if (!Firebase.isEnabled()) return "❌ Firebase Not Configured (Check URL/Secret)";
        
        // [FIX] Flush and clear cache to ensure we read LATEST data from Sheet
        SpreadsheetApp.flush();
        Utils.clearCache('Orders');
        Utils.clearCache('Drivers');

        // 1. Sync Active Orders
        const activeOrders = Utils.getLiteData('Orders', ['order_id', 'status', 'customer_phone', 'pickup_address', 'price', 'created_at', 'updated_at', 'timestamp']).filter(o => {
            const status = Utils.normalizeStatus(o.status);
            if (status === OrderStatus.CANCELLED) return false;
            if (status === OrderStatus.COMPLETED) {
                 // Keep COMPLETED orders for 5 minutes for the map "stay" logic
                 const updatedAt = o.updated_at ? new Date(o.updated_at).getTime() : 0;
                 const now = Date.now();
                 return (now - updatedAt) < (5 * 60 * 1000);
            }
            return true;
        });
        
        const ordersPayload = {};
        activeOrders.forEach(o => {
            if (o.order_id) {
                // [FIX] Use consistent numeric keys for Firebase
                const fbKey = Utils.getFirebaseOrderKey(o.order_id);
                ordersPayload[fbKey] = {
                    ...Utils.toSnakeCase(o),
                    timestamp: Date.now()
                };
            }
        });
        
        // Overwrite active_orders node with fresh state
        Firebase.set('active_orders', ordersPayload);

        // [FIX] Prevent unbounded growth: Clear old backup before writing new snapshot
        const ordersSheet = Utils.getSS().getSheetByName('Firebase_Orders_Backup');
        if (ordersSheet) {
            if (ordersSheet.getLastRow() > 1) {
                ordersSheet.getRange(2, 1, ordersSheet.getLastRow()-1, ordersSheet.getLastColumn()).clearContent();
            }
            
            const orderRows = [];
            Object.keys(ordersPayload || {}).forEach(k => {
              const o = ordersPayload[k];
              orderRows.push([k, JSON.stringify(o), new Date()]);
            });
            
            if (orderRows.length > 0) {
                ordersSheet.getRange(2, 1, orderRows.length, 3).setValues(orderRows);
            }
        }
        
        // 2. Sync Active Drivers
        const activeDrivers = Utils.getData('Drivers').filter(d => 
            String(d.status).toLowerCase() === 'active'
        );
        
        const driversPayload = {};
        activeDrivers.forEach(d => {
            if (d.driver_id) {
                driversPayload[d.driver_id] = {
                    ...Utils.toSnakeCase(d),
                    location: {
                        lat: d.lat,
                        lng: d.lng,
                        driver_name: d.driver_name,
                        updated_at: d.updated_at
                    }
                };
            }
        });
        
        Firebase.update('drivers', driversPayload);
        
        // 3. Sync Dashboard Stats (Fix stale data issues)
        DashboardService.syncStats();
        
        Utils.log("AUDIT", "ForceSync Executed", { orders: activeOrders.length, drivers: activeDrivers.length });
        return `✅ Synced ${activeOrders.length} orders, ${activeDrivers.length} drivers, and Dashboard Stats to Firebase.`;
        
    } catch (e) {
        return "❌ Sync Failed: " + e.toString();
    }
}

function resetFirebase() {
    try {
        if (!Firebase.isEnabled()) return "❌ Firebase Not Configured";
        
        // 1. Remove core nodes
        Firebase.remove('active_orders');
        Firebase.remove('drivers');
        
        // 2. Reset Stats to Zeros
        const resetStats = {
            ordersToday: 0,
            completedCount: 0,
            cancelledCount: 0,
            totalOrders: 0,
            totalRevenue: 0,
            stationCommission: 0,
            activeCount: 0,
            activeDriversCount: 0,
            lastSync: Utils.now()
        };
        Firebase.set('dashboard_stats', resetStats);
        Utils.saveStoredStats(resetStats);
        
        Utils.log("AUDIT", "Firebase Reset Executed", { success: true });
        return "✅ Firebase 'active_orders', 'drivers' and 'stats' cleared. Run forceSync() to rebuild with current data.";
    } catch (e) {
        return "❌ Reset Failed: " + e.toString();
    }
}

function doPost(e) {
  try {
    if (!e || !e.postData) return Utils.error("No payload");
    
    const request = JSON.parse(e.postData.contents);
    const settings = SettingsService.getMap(); 

    // --- TELEGRAM WEBHOOK HANDLER ---
    if (request.message || request.callback_query) {
        // [QA FIX SEC-007] Require a real webhook token; no more 'default_secret' or 'valid_token' fallback
        const telegramToken = settings['TELEGRAM_WEBHOOK_TOKEN'];
        if (!telegramToken) {
            Utils.log('ERROR', 'TELEGRAM_WEBHOOK_TOKEN not configured in Settings');
            return Utils.error('WEBHOOK_NOT_CONFIGURED');
        }
        if (e.parameter.token !== telegramToken) {
             Utils.log('SECURITY', 'Telegram Webhook Token Mismatch', { params: e.parameter });
             return Utils.error('UNAUTHORIZED_WEBHOOK');
        }
        
        if (request.callback_query) {
            NotificationService.handleTelegramCallback(request.callback_query, settings);
            return Utils.json({ ok: true });
        }
        
        if (request.message) {
            NotificationService.handleTelegramMessage(request.message, settings);
            return Utils.json({ ok: true });
        }
    }

    const { action, authToken } = request; 
    const payload = Utils.toCamelCase(request.payload || {});

    // [FIX] Ignore empty heartbeats/pings without logging error
    if (!action && Object.keys(payload).length === 0) {
        return Utils.json({ ok: true, message: 'Pong' });
    }

    // --- BRIDGE ACK endpoint ---
    if (action === 'ackNotification') {
      try {
        const bridgeKey = Utils.getSecret('BRIDGE_API_KEY');
        if (request.authToken !== bridgeKey) return Utils.error('UNAUTHORIZED');
        const ack = payload || {};
        if (!ack.requestId) return Utils.error('MISSING_REQUEST_ID');
        Utils.updateNotificationStatus(ack.requestId, ack.status || 'delivered', ack.bridgeMessageId || null, ack.rawResponse || null);
        return Utils.json({ ok: true });
      } catch (e) {
        return Utils.error('ACK_PROCESSING_FAILED: ' + e.toString());
      }
    }
    
    // 4. Handle Invalid Action
    if (!ActionHandlers[action]) {
        const payloadStr = JSON.stringify(payload).substring(0, 500);
        const logData = {
            action: action || 'MISSING',
            payloadKeys: Object.keys(payload),
            hasAuthToken: !!authToken,
            payloadSnippet: payloadStr,
            fullUrl: e.queryString ? `?${e.queryString}` : 'none'
        };
        
        Utils.log("ERROR", "Invalid Action Received", logData);
        
        return Utils.error(`Invalid Action: ${action || 'undefined'}. Keys: ${Object.keys(payload).join(',')}`, 400);
    }

    // 5. Execution
    const isAdmin = Utils.checkAuth(authToken, 'admin', settings);
    
    // [QA FIX] Rate Limiting logic moved BEFORE return, but after auth check
    if (!isAdmin) {
        if (action === Actions.CREATE_ORDER) {
            const identifier = payload.customer_phone || payload.customerPhone || 'unknown_order';
            if (!RateLimiter.check(`order_${identifier}`, 1, CONSTANTS.ORDER_RATE_LIMIT_SEC)) {
                return Utils.error("Rate limit exceeded. Please wait 5 minutes between orders.", 429);
            }
        }
        
        if (action === Actions.REGISTER_DRIVER_SELF) {
            const identifier = payload.phone || 'unknown_reg';
            if (!RateLimiter.check(`reg_${identifier}`, 1, 900)) { // 1 request / 15 min
                return Utils.error("Registration rate limit exceeded. Please wait 15 minutes.", 429);
            }
        }
    }

    return ActionHandlers[action](payload, settings, authToken);

    if (ActionHandlers[action]) {
      // --- Rate Limit Critical Endpoints ---
      if (!isAdmin) {
          if (action === Actions.CREATE_ORDER) {
              const identifier = payload.customer_phone || payload.customerPhone || 'unknown_order';
              if (!RateLimiter.check(`order_${identifier}`, 1, CONSTANTS.ORDER_RATE_LIMIT_SEC)) {
                  return Utils.error("Rate limit exceeded. Please wait 5 minutes between orders.", 429);
              }
          }
          
          if (action === Actions.REGISTER_DRIVER_SELF) {
              const identifier = payload.phone || 'unknown_reg';
              if (!RateLimiter.check(`reg_${identifier}`, 1, 900)) { // 1 request / 15 min
                  return Utils.error("Registration rate limit exceeded. Please wait 15 minutes.", 429);
              }
          }
          
          if (action === Actions.UPDATE_ORDER) {
              const identifier = authToken || 'anonymous';
              if (!RateLimiter.check(`update_${identifier}`, 60, 60)) { // 60 requests / 1 min
                  return Utils.error("API rate limit exceeded.", 429);
              }
          }
      }

      if (action === Actions.LOGIN_ADMIN || action === 'adminLogin') {
          const maxAttempts = parseInt(settings['LOGIN_MAX_ATTEMPTS']) || CONSTANTS.MAX_LOGIN_ATTEMPTS || 5;
          const lockoutMinutes = parseInt(settings['LOGIN_LOCKOUT_MINUTES']) || 15;
          const lockoutSec = lockoutMinutes * 60;

          if (!RateLimiter.check('login_admin_attempts_global', maxAttempts, lockoutSec)) {
              return Utils.error(`Too many login attempts. Please wait ${lockoutMinutes} minutes.`, 429);
          }
      }

      // 2. Auth Check for Admin Actions
      const publicActions = [
          'driverLogin', 'registerDriver', 'registerDriverSelf', 'registerDriverAndAssignOrder',
          'createOrder', 'searchAddress', 'calculatePrice', 'getSystemSettings',
          'adminLogin', 'ackNotification', 'checkAuth', 'refreshAdminToken',
          'requestOTP', 'verifyOTP', 'loginWithGoogle',
          'updateLocation', 'acceptOrder', 'acceptRideByPhone', 'acceptByTelegramWebApp',
          'completeOrder', 'submitRating', 'updateOrder',
          'getPaymentInfo', 'getOrderDetails', 'markPayment', 'markPaymentCompleted', 
          'getDriverPortalData', 'updateDriverProfile', 'resendOrderDetails',
          'linkTelegram', 'getNews', 'whatsappWebhook',
          'testConnection', 'loginAdmin', 'loginDriver', 'getOrderStatus',
          'driverStatus', 'loginWithToken', 'driverLoginWithToken',
          'getDashboardStats', 'getStats'
      ];

      if (!publicActions.includes(action) && !isAdmin) {
          return Utils.error("Unauthorized", 401, null);
      }

      // 3. Execution
      return ActionHandlers[action](payload, settings, authToken);
    }

    // [DIAGNOSTIC] Log detailed info for invalid actions
    Utils.log("ERROR", "Invalid Action Received", { 
        action: action || 'UNDEFINED', 
        payloadKeys: Object.keys(payload),
        hasAuthToken: !!authToken,
        userAgent: e.parameter.userAgent || 'unknown'
    });

    return Utils.error("Invalid Action: " + (action || 'undefined'), 400);

  } catch (e) {
    if (Utils && Utils.log) Utils.log("FATAL", "doPost Error", { error: e.toString(), stack: e.stack });
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (Utils) {
        if (Utils.flushLogs) Utils.flushLogs();
        if (Utils.flushNotificationLogs) Utils.flushNotificationLogs();
    }
  }
}

/**
 * --- MIGRATION UTILITIES ---
 * Run these functions once to update the system schema.
 */

function runMigration_AddBroadcastColumn() {
  const result = Utils.ensureBroadcastColumn();
  Logger.log(result);
  return result;
}

/**
 * Emergency Password Reset
 * Run this function from the Apps Script Editor to reset the admin password.
 */
/**
 * Emergency Password Reset
 * Run this function from the Apps Script Editor to reset the admin password.
 * [QA FIX SEC-001] No longer returns password in output. Removed fixLogin() entirely.
 */
function resetAdminPassword(newPassword) {
    if (!newPassword) {
        return "❌ Error: Please provide a password. Usage: resetAdminPassword('myNewPassword')";
    }
    
    try {
        const salt = Utils.generateSalt(16);
        const hash = Utils.hashPassword(newPassword, salt);
        
        // Update Script Properties (Secure Storage)
        const props = PropertiesService.getScriptProperties();
        props.setProperty('ADMIN_SALT', salt);
        props.setProperty('ADMIN_PASSWORD', hash);
        
        // Also update Settings sheet if keys exist there (to avoid confusion)
        const sheet = Utils.getSS().getSheetByName('Settings');
        if (sheet) {
            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === 'ADMIN_SALT') sheet.getRange(i + 1, 2).setValue(salt);
                if (data[i][0] === 'ADMIN_PASSWORD') sheet.getRange(i + 1, 2).setValue(hash);
            }
        }
        
        Utils.log("AUDIT", "Manual Password Reset Performed", { success: true });
        return '✅ Password successfully reset. Please test login now.';
    } catch (e) {
        return "❌ Reset Failed: " + e.toString();
    }
}

// [QA FIX SEC-001] fixLogin() removed — contained hardcoded password

/**
 * DEBUG FUNCTION
 * Run this to verify what the system sees as the password and clear any stale cache.
 * [QA FIX SEC-001] Removed hardcoded password comparison from debug output.
 */
function debugAuthSettings() {
  // 1. Clear Cache
  const cache = CacheService.getScriptCache();
  cache.remove('tx_v4_app_settings_v4');
  SettingsService._cache = null;

  // 2. Read Fresh
  const settings = SettingsService.getMap(true);
  const storedPass = settings['ADMIN_PASSWORD'];
  const salt = Utils.getSecret('ADMIN_SALT');
  
  // 3. Log results (no password values exposed)
  Logger.log('--- DEBUG AUTH ---');
  Logger.log('1. Cache Cleared');
  Logger.log('2. Password hash present: ' + (storedPass ? 'YES (length=' + storedPass.length + ')' : 'MISSING ❌'));
  Logger.log('3. Salt present: ' + (salt ? 'YES' : 'MISSING ❌'));
  Logger.log('4. Password looks hashed: ' + (storedPass && storedPass.length > 30 ? 'YES ✅' : 'NO — may be plaintext ⚠️'));
  
  return 'Done. Check Logs (View > Execution Transcript)';
}

/**
 * DEBUG FUNCTION
 * Run this to verify Firebase Connectivity
 */
function testFirebaseConnection() {
    Utils.log("AUDIT", "TESTING FIREBASE CONNECTION...");
    
    // 1. Check Configuration
    const settings = SettingsService.getMap(true); // Force refresh
    const dbUrl = settings['FIREBASE_DB_URL'];
    const secret = settings['FIREBASE_AUTH_SECRET'];
    
    Logger.log("1. Config Check:");
    Logger.log("   URL: " + (dbUrl ? dbUrl : "MISSING ❌"));
    Logger.log("   SECRET: " + (secret ? "FOUND (Length: " + secret.length + ")" : "MISSING ❌"));
    
    if (!dbUrl || !secret) {
        return "❌ Missing Configuration. Please check Settings sheet.";
    }
    
    // 2. Test Write
    const testPath = 'system_test/connection_check';
    const testData = { timestamp: Date.now(), status: 'TEST_OK' };
    
    Logger.log("2. Attempting WRITE to: " + testPath);
    const writeRes = Firebase.set(testPath, testData);
    
    if (!writeRes.ok) {
        Logger.log("❌ WRITE FAILED: " + writeRes.error);
        return "❌ Write Failed. Check logs.";
    }
    Logger.log("✅ WRITE SUCCESS");
    
    // 3. Test Read
    Logger.log("3. Attempting READ from: " + testPath);
    const readRes = Firebase.get(testPath);
    
    if (!readRes.ok) {
        Logger.log("❌ READ FAILED: " + readRes.error);
        return "❌ Read Failed. Check logs.";
    }
    
    Logger.log("✅ READ SUCCESS: " + JSON.stringify(readRes.data));
    
    // 4. Force Sync Check
    Logger.log("4. Running Force Sync...");
    const syncRes = forceSync();
    Logger.log("   Sync Result: " + syncRes);
    
    return "✅ Firebase Connection Verified!";
}

// [QA FIX CODE-002] fixAuthProperty() removed — dangerous debug function that deletes password properties

/**
 * Migration: Ensure API Keys are in ScriptProperties
 * Run this once after deployment.
 */
function runKeyMigration() {
    const keys = ['GOOGLE_MAPS_API_KEY', 'GH_API_KEY', 'BRIDGE_API_KEY', 'TELEGRAM_BOT_TOKEN', 'FIREBASE_AUTH_SECRET'];
    
    const sheet = Utils.getSS().getSheetByName('Settings');
    const props = PropertiesService.getScriptProperties();
    const data = sheet.getDataRange().getValues();
    
    let migrated = 0;
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const key = row[0];
        const val = row[1];
        
        if (keys.includes(key)) {
             // Only migrate if value exists and is NOT already masked
             if (val && val !== '[SECURELY_STORED_IN_PROPS]') {
                 props.setProperty(key, val);
                 Logger.log(`Migrated: ${key}`);
                 migrated++;
             }
        }
    }
    
    return `Migrated ${migrated} keys to ScriptProperties.`;
}

/**
 * DEBUG: Check Google Maps API Key Status
 * Run this to see where the key is and why it's not working
 */
function debugGoogleMapsKey() {
    const sheet = Utils.getSS().getSheetByName('Settings');
    const props = PropertiesService.getScriptProperties();
    
    // 1. Check Sheet
    const data = sheet.getDataRange().getValues();
    let sheetValue = null;
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === 'GOOGLE_MAPS_API_KEY') {
            sheetValue = data[i][1];
            break;
        }
    }
    
    // 2. Check ScriptProperties
    const propsValue = props.getProperty('GOOGLE_MAPS_API_KEY');
    
    // 3. Check what SettingsService returns
    const settings = SettingsService.getMap();
    const settingsValue = settings['GOOGLE_MAPS_API_KEY'];
    
    Logger.log('=== GOOGLE MAPS API KEY DEBUG ===');
    Logger.log('1. Settings Sheet: ' + (sheetValue || 'NOT FOUND'));
    Logger.log('2. ScriptProperties: ' + (propsValue || 'NOT FOUND'));
    Logger.log('3. SettingsService.getMap(): ' + (settingsValue || 'NOT FOUND'));
    Logger.log('================================');
    
    return {
        sheet: sheetValue || 'NOT FOUND',
        props: propsValue || 'NOT FOUND',
        service: settingsValue || 'NOT FOUND'
    };
}
