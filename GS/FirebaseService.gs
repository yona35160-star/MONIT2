/**
 * FIREBASE SERVICE & SYNC UTILITY
 * Consolidated Firebase client and synchronization logic.
 */

const Firebase = {
  _cachedBaseUrl: null,
  _cachedAuthToken: null,

  getBaseUrl: () => {
    if (Firebase._cachedBaseUrl) return Firebase._cachedBaseUrl;
    let url = Utils.getSecret('FIREBASE_DB_URL');
    if (!url) {
      const settings = SettingsService.getMap();
      const projectId = settings['FIREBASE_PROJECT_ID'] || '';
      url = `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app/`;
    }
    Firebase._cachedBaseUrl = url.endsWith('/') ? url : url + '/';
    return Firebase._cachedBaseUrl;
  },

  getAuthToken: () => {
    if (Firebase._cachedAuthToken) return Firebase._cachedAuthToken;
    Firebase._cachedAuthToken = Utils.getSecret('FIREBASE_AUTH_SECRET');
    return Firebase._cachedAuthToken;
  },

  _safeRequest: (path, method, data = null) => {
    try {
      const baseUrl = Firebase.getBaseUrl();
      const token = Firebase.getAuthToken();
      if (!baseUrl || !token) return { ok: false, error: 'Firebase config missing' };

      const url = `${baseUrl}${path}.json` + (token ? `?auth=${token}` : '');
      const options = { method, contentType: 'application/json', muteHttpExceptions: true };
      if (data) options.payload = JSON.stringify(data);
      
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
          try {
              const resp = UrlFetchApp.fetch(url, options);
              const code = resp.getResponseCode();
              if (code >= 200 && code < 300) return { ok: true, data: JSON.parse(resp.getContentText() || '{}') };
              if (code >= 500) { lastError = `HTTP ${code}`; Utilities.sleep(500 * attempt); continue; }
              return { ok: false, error: `Firebase ${code}` };
          } catch (e) { lastError = e; Utilities.sleep(500 * attempt); }
      }
      return { ok: false, error: String(lastError) };
    } catch (e) { return { ok: false, error: e.toString() }; }
  },

  set: (path, data) => Firebase._safeRequest(path, 'put', data),
  update: (path, data) => Firebase._safeRequest(path, 'patch', data),
  push: (path, data) => Firebase._safeRequest(path, 'post', data),
  get: (path) => Firebase._safeRequest(path, 'get'),
  remove: (path) => Firebase._safeRequest(path, 'delete'),

  isEnabled: () => !!Firebase.getAuthToken(),

  syncSheetRow: (sheetName, rowObj) => {
    if (!Firebase.isEnabled() || !rowObj) return { ok: true, ignored: true };
    let path = null;
    switch (sheetName) {
      case 'Orders': path = rowObj.order_id ? `active_orders/${Utils.getFirebaseOrderKey(rowObj.order_id)}` : null; break;
      case 'Drivers': path = rowObj.driver_id ? `drivers/${String(rowObj.driver_id).trim().toUpperCase().replace(/^TAXI-/, '')}` : null; break;
      case 'Customers': path = rowObj.customer_phone ? `customers/${Utils.normalizePhone(rowObj.customer_phone)}` : null; break;
      case 'Settings': path = 'settings'; break;
    }
    if (!path) return { ok: false, error: 'Invalid path' };
    const sanitized = { _synced_at: Date.now() };
    Object.keys(rowObj).forEach(k => {
      if (k.startsWith('_')) return;
      const v = rowObj[k];
      sanitized[k] = v instanceof Date ? v.toISOString() : (v === null || v === undefined ? '' : v);
    });
    return Firebase._safeRequest(path, 'patch', sanitized);
  }
};

const FirebaseSync = {
  BATCH_SIZE: 50,
  syncAllSheets: () => {
    FirebaseSync.syncSettings();
    FirebaseSync.syncDrivers();
    FirebaseSync.syncCustomers();
    FirebaseSync.syncOrders(500);
    return { ok: true };
  },
  syncSettings: () => {
    const settings = SettingsService.getMap();
    const sanitized = { _synced_at: Date.now() };
    const SENSITIVE = ['ADMIN_PASSWORD', 'JWT_SECRET', 'FIREBASE_AUTH_SECRET', 'BRIDGE_API_KEY'];
    Object.keys(settings).forEach(k => { if (!SENSITIVE.includes(k)) sanitized[k] = settings[k]; });
    return Firebase.set('settings', sanitized);
  },
  syncDrivers: () => {
    const drivers = Utils.getData('Drivers', true);
    drivers.forEach(d => Firebase.syncSheetRow('Drivers', d));
    return { ok: true };
  },
  syncCustomers: () => {
    const customers = Utils.getData('Customers', true);
    customers.forEach(c => Firebase.syncSheetRow('Customers', c));
    return { ok: true };
  },
  syncOrders: (limit) => {
    const orders = Utils.getData('Orders', true, limit);
    orders.forEach(o => Firebase.syncSheetRow('Orders', o));
    return { ok: true };
  }
};
