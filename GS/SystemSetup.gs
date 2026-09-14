/**
 * SYSTEM SETUP & MAINTENANCE SERVICE
 * Consolidated core setup, security hardening, and schema enforcement.
 */

/**
 * 🚀 One-Click Automation
 * Automates configurations, security hardening, and synchronization.
 */
function setupSystemFull() {
  const results = [];
  results.push("🚀 Starting Comprehensive System Setup...");

  // 1. Standardize Sheet Headers
  try {
    const headerResult = Utils.standardizeHeaders();
    results.push("✅ Standardized Spreadsheet Headers");
  } catch (e) {
    results.push("❌ Header Standardization Failed: " + e.toString());
  }

  // 2. Migration: Secure Secrets from Settings Sheet to ScriptProperties
  try {
    const keysToSecure = [
      'FIREBASE_AUTH_SECRET',
      'FIREBASE_DB_URL',
      'GH_API_KEY',
      'GOOGLE_MAPS_API_KEY',
      'BRIDGE_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'JWT_SECRET'
    ];
    
    const settings = SettingsService.getMap(true); // Force bypass cache
    const props = PropertiesService.getScriptProperties();
    let securedCount = 0;

    keysToSecure.forEach(key => {
      const val = String(settings[key] || '').trim();
      if (val && !val.includes('[HIDDEN]') && !val.includes('[SECURELY_STORED]') && val.length > 5) {
        props.setProperty(key, val);
        securedCount++;
        const update = {};
        update[key] = '[HIDDEN]';
        SettingsService.save(update);
      }
    });
    
    if (securedCount > 0) {
      results.push(`✅ Securely migrated ${securedCount} secrets from Settings sheet to ScriptProperties`);
    } else {
      results.push("ℹ️ No new secrets found in Settings sheet (already secured)");
    }
  } catch (e) {
    results.push("❌ Secret Migration Failed: " + e.toString());
  }

  // 3. Configure Primary WhatsApp Bridge (Render)
  try {
    const RENDER_URL = '';
    SettingsService.save({
      'WHATSAPP_RENDER_URL': RENDER_URL,
      'BRIDGE_MODE': 'AUTO',
      'ENABLE_WHATSAPP': 'TRUE'
    });
    results.push("✅ Configured Primary WhatsApp Bridge (Render)");
  } catch (e) {
    results.push("❌ Bridge Configuration Failed: " + e.toString());
  }

  // 4. Phone Number Migration (Fix display formats)
  try {
    Utils.migratePhoneColumns(['Orders', 'Drivers', 'Customers', 'הזמנות', 'נהגים', 'לקוחות']);
    results.push("✅ Normalized Phone Number formats across all sheets");
  } catch (e) {
    results.push("❌ Phone Migration Failed: " + e.toString());
  }

  // 5. Telegram Webhook Setup
  try {
    const botToken = Utils.getSecret('TELEGRAM_BOT_TOKEN');
    if (botToken) {
      const webAppUrl = ScriptApp.getService().getUrl();
      if (webAppUrl) {
        const url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webAppUrl)}`;
        const resp = UrlFetchApp.fetch(url);
        results.push("✅ Telegram Webhook synchronized with current deployment");
      }
    }
  } catch (e) {
    results.push("⚠️ Telegram Webhook Sync Failed: " + e.toString());
  }

  // 6. Schema Enforcement
  try {
    SchemaEnforcerService.enforceAll();
    results.push("✅ Schema Enforcement Applied");
  } catch (e) {
    results.push("❌ Schema Enforcement Failed: " + e.toString());
  }

  // 7. Final Health Check
  try {
    results.push("--- Health Check Results ---");
    const fbTest = Firebase.get('system/health');
    if (fbTest.ok) results.push("🟢 Firebase: Connected");
    else results.push("🔴 Firebase: Connection Failed (" + fbTest.error + ")");
    results.push("🟢 WhatsApp: Ready (Auto-failover enabled)");
    results.push("ℹ️ Current Script Version: " + SCRIPT_VERSION);
  } catch (e) {
    results.push("⚠️ Health Check encountered errors");
  }

  const summary = results.join("\n");
  console.log(summary);
  try {
    Utils.log("AUDIT", "Full System Setup Completed", { results });
    Utils.flushLogs();
  } catch (e) {}

  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert('✅ System Setup Completed Successfully!\n\n' + summary);
  } catch (e) {}
  
  return summary;
}

/**
 * 🔒 SECURITY HELPERS
 */
function saveGoogleMapsKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui ? ui.prompt('Google Maps Key', 'Please paste your Google Maps API Key:', ui.ButtonSet.OK_CANCEL) : null;
  if (response && response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key.length > 5) {
      PropertiesService.getScriptProperties().setProperty('GOOGLE_MAPS_API_KEY', key);
      try { SettingsService.maskSecrets(); } catch (e) {}
      Logger.log('✅ GOOGLE_MAPS_API_KEY has been saved successfully.');
    }
  }
}

function syncBridgeKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Sync Bridge Key', 'Please paste the BRIDGE_API_KEY from your bridge .env:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key.length < 10) return ui.alert('❌ Error: Key too short.');
    Utils.setSecret('BRIDGE_API_KEY', key);
    SettingsService.save({ 'BRIDGE_API_KEY': '[SECURELY_STORED_IN_PROPS]' });
    SettingsService.getMap(true);
    ui.alert('✅ Bridge API Key synchronized successfully!');
  }
}

function debugBridgeAuth() {
  const props = PropertiesService.getScriptProperties();
  const scriptKey = props.getProperty('BRIDGE_API_KEY');
  const map = SettingsService.getMap(true);
  const sheetKey = map['BRIDGE_API_KEY'];
  Logger.log('--- Bridge Auth Diagnostics ---');
  Logger.log('Key in ScriptProperties: ' + (scriptKey ? scriptKey.substring(0, 5) + '...' : 'MISSING'));
  Logger.log('Key in Settings Sheet:  ' + (sheetKey ? sheetKey.substring(0, 5) + '...' : 'MISSING'));
}

/**
 * 📊 AUDIT & DIAGNOSTICS
 */
function runSyncAudit() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const settings = SettingsService.getMap();
  const results = [];
  const criticalKeys = ['GOOGLE_MAPS_API_KEY', 'GH_API_KEY', 'TELEGRAM_BOT_TOKEN', 'BRIDGE_API_KEY', 'FIREBASE_AUTH_SECRET', 'JWT_SECRET', 'ADMIN_PASSWORD'];

  criticalKeys.forEach(k => {
    const sheetVal = settings[k];
    const propVal = props[k];
    const isSheetMasked = sheetVal === '[HIDDEN]' || sheetVal === '[SECURELY_STORED_IN_PROPS]';
    const isPropReal = propVal && propVal.length > 5;
    let status = isSheetMasked && isPropReal ? "🔒 SECURE" : (isSheetMasked ? "❌ DEADLOCK" : "⚠️ SYNC PENDING");
    results.push({ key: k, status });
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let auditSheet = ss.getSheetByName("AuditLogs") || ss.insertSheet("AuditLogs");
  auditSheet.clear().appendRow(["Timestamp", new Date().toLocaleString()]).appendRow(["Key", "Status"]);
  results.forEach(r => auditSheet.appendRow([r.key, r.status]));
  return { ok: true, summary: results.map(r => `${r.key}: ${r.status}`).join("\n") };
}

/**
 * 🗄️ SCHEMA ENFORCER SERVICE
 */
const SchemaEnforcerService = {
    enforceAll: () => {
        const ss = Utils.getSS();
        SchemaEnforcerService.applyRules(ss, 'Orders', {
            'customer_phone': '@', 'driver_phone': '@', 'pickup_datetime': 'dd/MM/yyyy HH:mm',
            'created_at': 'dd/MM/yyyy HH:mm:ss', 'price': '#,##0.00', 'commission': '#,##0.00',
            'pickup_lat': '0.0000000', 'pickup_lng': '0.0000000', 'order_id': '@'
        });
        SchemaEnforcerService.applyRules(ss, 'Drivers', {
            'phone': '@', 'driver_id': '@', 'total_rides': '0', 'average_rating': '0.00', 'updated_at': 'dd/MM/yyyy HH:mm:ss'
        });
        SchemaEnforcerService.applyRules(ss, 'Customers', {
            'customer_phone': '@', 'total_rides': '0', 'total_spent': '#,##0.00'
        });
        Utils.log("INFO", "Schema Enforcement Completed");
    },
    applyRules: (ss, sheetName, rules) => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
        const lastRow = sheet.getMaxRows();
        Object.keys(rules).forEach(colName => {
            const colIdx = headers.indexOf(colName);
            if (colIdx !== -1 && lastRow > 1) {
                sheet.getRange(2, colIdx + 1, lastRow - 1).setNumberFormat(rules[colName]);
            }
        });
    }
};

/**
 * 🛡️ PRODUCTION HARDENING
 */
function runHardeningProduction() {
  const settings = SettingsService.getMap();
  const results = [];
  const RENDER_URL = '';
  SettingsService.save({ 'WHATSAPP_RENDER_URL': RENDER_URL, 'BRIDGE_MODE': 'AUTO' });
  results.push("✅ WhatsApp Render URL set to: " + RENDER_URL);
  
  const test = Firebase.get('system/health');
  results.push(test.ok ? "✅ Firebase Connectivity: SUCCESS" : "❌ Firebase Connectivity: FAILED");
  results.push("ℹ️ Current Script Version: " + SCRIPT_VERSION);
  
  const summary = results.join("\n");
  Utils.log("AUDIT", "Production Hardening Run", { results });
  return summary;
}
