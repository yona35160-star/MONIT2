/**
 * Settings Service
 * Manages system configuration with multi-level caching
 * 
 * Dependencies: Utils.gs, Config.gs (Schema, DEFAULT_SETTINGS)
 */

const SettingsService = {
  _cache: null,
  _cacheTime: 0,
  CACHE_TTL: 10 * 60 * 1000, // 10 minutes in memory
  SCRIPT_CACHE_KEY: 'tx_v4_app_settings_v4',
  
  getMap: (force = false) => {
    const now = Date.now();
    // 1. In-memory check (Skip if forced)
    if (!force && SettingsService._cache && (now - SettingsService._cacheTime) < SettingsService.CACHE_TTL) {
      return SettingsService._cache;
    }
    
    // 2. ScriptCache check (Skip if forced)
    const scriptCache = CacheService.getScriptCache();
    if (!force) {
        const cached = scriptCache.get(SettingsService.SCRIPT_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Integrity check: ADMIN_PASSWORD must be present and not a masked placeholder
                const pw = parsed['ADMIN_PASSWORD'];
                const isCorrupt = !pw || pw === '[HIDDEN]' || pw === '[SECURELY_STORED_IN_PROPS]' || String(pw).trim().length < 3;
                if (isCorrupt) {
                    Utils.log("WARN", "SettingsService: Cached settings corrupt or masked - invalidating");
                    scriptCache.remove(SettingsService.SCRIPT_CACHE_KEY);
                } else {
                    SettingsService._cache = parsed;
                    SettingsService._cacheTime = now;
                    return parsed;
                }
            } catch (e) { /* fallback */ }
        }
    }

    // 3. Sheet fallback
    let sheet = Utils.getSS().getSheetByName(Schema.Sheets.SETTINGS);
    if (!sheet) {
        sheet = Utils.getSS().insertSheet(Schema.Sheets.SETTINGS);
    }

    const data = sheet.getDataRange().getValues();
    const map = {};
    for (let i = 1; i < data.length; i++) {
        const rawKey = data[i][0];
        if (rawKey) {
            const key = String(rawKey).trim();
            // FILTER: Skip internal JSON dumps or temp keys
            if (key.startsWith('dashboard') || key.startsWith('active_')) continue;
            
            const rawVal = data[i][1];
            if (rawVal instanceof Date) {
                // Heuristic: If year is 1899, it's a Time value in Google Sheets
                if (rawVal.getFullYear() < 1910) {
                    map[key] = Utilities.formatDate(rawVal, "Asia/Jerusalem", "HH:mm");
                } else {
                    // It's a real date
                    map[key] = Utilities.formatDate(rawVal, "Asia/Jerusalem", "yyyy-MM-dd");
                }
            } else {
                map[key] = String(rawVal);
            }
        }
    }

    // OVERLAY: Prioritize ScriptProperties for secrets and dynamic URLs
    try {
        const scriptProps = PropertiesService.getScriptProperties();
        const props = scriptProps.getProperties();
        
        Object.keys(props).forEach(k => {
            const propVal = props[k];
            if (propVal && String(propVal).trim() !== '' && !String(propVal).includes('[HIDDEN]')) {
                // Only overlay if the sheet has a placeholder or is missing/broken
                if (map[k] === '[SECURELY_STORED_IN_PROPS]' || map[k] === '[HIDDEN]' || !map[k] || String(map[k]).includes('...')) {
                    map[k] = propVal;
                }
            }
        });
        
        // [FIX] Explicit Sync: If key is in map (Sheet) but NOT in Props, sync it to Props for security and persistence
        const criticalKeys = ['GOOGLE_MAPS_API_KEY', 'GH_API_KEY', 'TELEGRAM_BOT_TOKEN', 'BRIDGE_API_KEY', 'FIREBASE_AUTH_SECRET', 'JWT_SECRET', 'ADMIN_PASSWORD'];
        criticalKeys.forEach(k => {
            const val = map[k];
            const inProps = props[k];
            const isPropsReal = inProps && inProps !== '[HIDDEN]' && inProps !== '[SECURELY_STORED_IN_PROPS]' && String(inProps).trim().length > 3;

            // Safety check: If value is a placeholder but Props has no REAL value → Deadlock
            if ((val === '[SECURELY_STORED_IN_PROPS]' || val === '[HIDDEN]') && !isPropsReal) {
                Utils.log("ERROR", `Settings Deadlock: ${k} is masked in Sheet and Props has no real value (Props="${inProps || 'EMPTY'}"). System will fail for this service.`);
                map[k] = ""; // Clear the placeholder so we don't send literal "[HIDDEN]" to APIs
                // Also purge the bad value from Props if it's [HIDDEN]
                if (inProps === '[HIDDEN]' || inProps === '[SECURELY_STORED_IN_PROPS]') {
                    try { scriptProps.deleteProperty(k); } catch(de) {}
                }
            }

            // Auto-sync real values to props
            if (val && val.length > 5 && val !== '[SECURELY_STORED_IN_PROPS]' && val !== '[HIDDEN]' && !isPropsReal) {
                scriptProps.setProperty(k, val);
                Utils.log("AUDIT", `Settings: Auto-synced ${k} to ScriptProperties`);
            }
        });

    } catch (e) { Utils.log("ERROR", "Settings: Props retrieval failed", e.toString()); }

    // [DEBUG] Log API Key Presence (not the key itself)
    Utils.log("DEBUG", "Settings: API Keys connectivity", {
        hasGoogle: !!map['GOOGLE_MAPS_API_KEY'],
        googleLength: map['GOOGLE_MAPS_API_KEY'] ? map['GOOGLE_MAPS_API_KEY'].length : 0,
        hasGH: !!map['GH_API_KEY'],
        ghLength: map['GH_API_KEY'] ? map['GH_API_KEY'].length : 0
    });

    // MERGE: Ensure all DEFAULT_SETTINGS exist in the map
    let dirty = false;
    DEFAULT_SETTINGS.forEach(item => {
         const key = item.key;
         const val = item.value;
         if (!map.hasOwnProperty(key)) {
             map[key] = val;
             dirty = true;
         }
    });

    SettingsService._cache = map;
    SettingsService._cacheTime = now;
    scriptCache.put(SettingsService.SCRIPT_CACHE_KEY, JSON.stringify(map), 1800); // 30 mins
    return map;
  },

  ensureDefaults: (context) => {
      let sheet = context;
      // Handle case where Spreadsheet is passed instead of specific Sheet
      if (context && context.getSheetByName) {
          sheet = context.getSheetByName(Schema.Sheets.SETTINGS);
          if (!sheet) sheet = context.insertSheet(Schema.Sheets.SETTINGS);
      }
      
      // Ensure Headers
      if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== 'key') {
          if (sheet.getLastRow() > 0) sheet.insertRowBefore(1);
          sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]).setFontWeight("bold").setBackground("#f3f3f3");
      }

      // 1. Load Existing Keys from Sheet (Critical Step!)
      const data = sheet.getDataRange().getValues();
      const existingKeys = new Set();
      // Start from row 1 (exclude header 0)
      for (let i = 1; i < data.length; i++) {
          if (data[i][0]) existingKeys.add(String(data[i][0]));
      }

      const newRows = [];
      let addedCount = 0;
      
      // 2. Check Defaults against Existing
      DEFAULT_SETTINGS.forEach(item => {
          const key = item.key;
          const val = item.value;
          
          if (!existingKeys.has(key)) {
              newRows.push([key, val]);
              existingKeys.add(key); // Mark as added to prevent internal dups
              addedCount++;
          }
      });

      // 3. Append Only Missing
      if (newRows.length > 0) {
          const startRow = sheet.getLastRow() + 1;
          const numRows = newRows.length;
          sheet.getRange(startRow, 1, numRows, 2).setValues(newRows);
          Utils.log("AUDIT", `Settings: Added ${numRows} missing keys`, { keys: newRows.map(r => r[0]) });
          
          // Invalidate cache force reload next time
          CacheService.getScriptCache().remove(SettingsService.SCRIPT_CACHE_KEY);
          SettingsService._cache = null;
      }
  },
  
  save: (newSettings) => {
    // [HARDENING] Lock to prevent race conditions on Settings Save
    const lock = LockService.getScriptLock();
    try {
        if (!lock.tryLock(5000)) return Utils.error('System busy, try again.');
        
        let sheet = Utils.getSS().getSheetByName(Schema.Sheets.SETTINGS);
        if (!sheet) {
            sheet = Utils.getSS().insertSheet(Schema.Sheets.SETTINGS);
            // Add headers if new
            sheet.appendRow(['key', 'value']);
        }
        
        // Refresh data inside lock
        const currentData = sheet.getDataRange().getValues();
        const keys = currentData.map(r => r[0]);
        
        const props = PropertiesService.getScriptProperties();
        const changes = [];
        
        Object.keys(newSettings).forEach(k => {
          let val = newSettings[k];
          
          if (typeof val === 'object' && val !== null) {
              if (k === 'settings' || k === 'payload') return;
              val = JSON.stringify(val);
          }
          
          val = String(val);
          const idx = keys.indexOf(k);
          const oldVal = idx > -1 ? String(currentData[idx][1]) : null;

          if (val === oldVal) return; // No change

          if (idx > -1) {
            Utils.log("DEBUG", "Settings: Updating existing key", { key: k, row: idx + 1 });
            sheet.getRange(idx + 1, 2).setValue(val);
          } else {
            Utils.log("DEBUG", "Settings: Appending new key", { key: k });
            sheet.appendRow([k, val]);
            keys.push(k); 
          }
          
          changes.push({ key: k, from: (k.includes('PASS') || k.includes('TOKEN') || k.includes('SECRET')) ? '***' : oldVal, to: (k.includes('PASS') || k.includes('TOKEN') || k.includes('SECRET')) ? '***' : val });

          if (['WHATSAPP_BRIDGE_URL', 'BRIDGE_API_KEY', 'TELEGRAM_BOT_TOKEN', 
               'LAST_ORDER_ID', 'FIREBASE_AUTH_SECRET', 'TARGET_GROUP_JID', 'FIREBASE_PROJECT_ID', 
               'FIREBASE_DB_URL', 'TELEGRAM_CHAT_ID', 'GOOGLE_MAPS_API_KEY', 'GH_API_KEY'].includes(k) || props.getProperty(k)) {
              
              // [FIX] Prevent overwriting real secrets with masking placeholders
              if (val !== '[SECURELY_STORED_IN_PROPS]' && val !== '[HIDDEN]' && val !== '***') {
                  props.setProperty(k, val);
              }
          }
        });
        
        SpreadsheetApp.flush(); // Ensure updates are committed
        
        if (changes.length > 0) {
            Utils.log("AUDIT", "Settings Updated", { count: changes.length, changes });
        }
        
        // INTEGRATION AUDIT FIX: Ensure essential headers exist
        try {
            Utils.ensureHeaders('Orders', [
                'Order ID', 'Customer Name', 'Customer Phone', 'Pickup Address', 'Destination Address',
                'Pickup DateTime', 'Price', 'Status', 'Driver Name', 'Driver ID', 
                'Created At', 'Updated At', 'Pickup Notes', 'Destination Notes',
                'Pickup Exact Address', 'Destination Exact Address', 'Commission', 'Profit', 
                'Idempotency Key', 'Pickup Lat', 'Pickup Lng', 'Destination Lat', 'Destination Lng'
            ]);
            // ... (Other EnsureHeaders calls if needed)
        } catch (e) {
            Utils.log("ERROR", "Failed to ensure headers during settings save", e.toString());
        }
    
        // Invalidate caches after save
        SettingsService._cache = null;
        SettingsService._cacheTime = 0;
        CacheService.getScriptCache().remove(SettingsService.SCRIPT_CACHE_KEY);

        // [FIREBASE SYNC] Sync updated settings to Firebase (sanitized)
        try {
          if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.syncSettings();
          }
        } catch(fe) {
          console.error('Settings Firebase sync failed:', fe);
        }
    
        return Utils.json({ ok: true });
    } catch (e) {
        Utils.log("ERROR", "Settings Save Failed", e.toString());
        return Utils.error("Settings save failed");
    } finally {
        lock.releaseLock();
    }
  },

  /**
   * Migrate sensitive keys from Settings sheet to Script Properties.
   * This copies keys but does not delete them from the sheet.
   */
  migrateSettingsToProperties: (keys) => {
    try {
      const defaults = ['GH_API_KEY','BRIDGE_API_KEY','TELEGRAM_BOT_TOKEN','JWT_SECRET','ADMIN_SALT','ADMIN_EMAIL', 'GOOGLE_MAPS_API_KEY'];
      keys = Array.isArray(keys) && keys.length ? keys : defaults;
      const map = SettingsService.getMap();
      const migrated = [];
      const failed = [];
      const props = PropertiesService.getScriptProperties();
      keys.forEach(k => {
        try {
          const val = map[k];
          const existing = props.getProperty(k);
          if (existing && String(existing).trim() !== '') {
            // already present in properties - skip
            return;
          }
          if (val && String(val).trim() !== '') {
            props.setProperty(k, String(val));
            migrated.push(k);
          }
        } catch (e) {
          failed.push({ key: k, err: e.toString() });
        }
      });
      Utils.log('AUDIT', 'Settings migrated to Properties', { migrated, failed });
      return Utils.json({ ok: true, migrated, failed });
    } catch (e) {
      Utils.log('ERROR', 'Migration to Properties failed', e.toString());
      return Utils.error('Migration failed: ' + e.toString());
    }
  },
  
  getAll: (params) => {
      // Wrapper for getMap but returns standard JSON structure
      const force = params && params.force === true;
      const map = SettingsService.getMap(force);
      return Utils.json({ ok: true, data: map });
  },

  /**
   * Hardens security by masking values in the Sheet that are also in ScriptProperties
   */
  maskSecrets: () => {
    const sensitiveKeys = [
      // Core auth / crypto
      'ADMIN_SALT', 'FIREBASE_AUTH_SECRET', 'JWT_SECRET',
      // Messaging / bridges
      'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_WEBHOOK_TOKEN', 'PUBLISH_TELEGRAM_BOT_TOKEN',
      'BRIDGE_API_KEY',
      // External APIs
      'GOOGLE_MAPS_API_KEY', 'GH_API_KEY',
      'FACEBOOK_ADS_ACCESS_TOKEN', 'PUBLISH_FACEBOOK_PAGE_TOKEN'
    ];
    
    const props = PropertiesService.getScriptProperties();
    const sheet = Utils.getSS().getSheetByName(Schema.Sheets.SETTINGS);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const updates = {};
    let maskedCount = 0;

    for (let i = 1; i < data.length; i++) {
        const key = String(data[i][0] || '').trim();
        const val = String(data[i][1] || '').trim();
        
        if (sensitiveKeys.includes(key)) {
            const inProps = props.getProperty(key);
            // If it's already in props and the sheet has a real value, mask it
            if (inProps && val !== '[SECURELY_STORED_IN_PROPS]' && val !== '') {
                updates[key] = '[SECURELY_STORED_IN_PROPS]';
                maskedCount++;
            }
        }
    }

    if (maskedCount > 0) {
        SettingsService.save(updates);
        Utils.log("AUDIT", `Masked ${maskedCount} secrets in Settings sheet`);
    }
  },

  /**
   * Removes obsolete/duplicate keys from Settings sheet.
   * Call from setupSystem to clean legacy entries.
   */
  removeObsoleteKeys: () => {
    const OBSOLETE_KEYS = ['WHATSAPP_BRIDGE_URL1', 'WHATSAPPBRIDGEURL'];
    const sheet = Utils.getSS().getSheetByName(Schema.Sheets.SETTINGS);
    if (!sheet || sheet.getLastRow() < 2) return 0;

    const data = sheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0] || '').trim();
      if (OBSOLETE_KEYS.includes(key)) rowsToDelete.push(i + 1); // 1-based row index
    }
    // Delete from bottom to top to avoid index shift
    rowsToDelete.sort((a, b) => b - a);
    rowsToDelete.forEach(row => sheet.deleteRow(row));
    if (rowsToDelete.length > 0) {
      SettingsService._cache = null;
      CacheService.getScriptCache().remove(SettingsService.SCRIPT_CACHE_KEY);
      const removed = rowsToDelete.map(r => data[r - 1][0]);
      Utils.log("AUDIT", "Settings: Removed obsolete keys", { keys: removed });
    }
    return rowsToDelete.length;
  }
};
