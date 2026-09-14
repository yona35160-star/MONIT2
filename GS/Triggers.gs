/**
 * Triggers Service
 * Automated task management and self-healing triggers
 */
const TriggersService = {
  /**
   * Main entry point for setting up all system triggers.
   * Can be called manually or during system setup.
   */
  setupAutomation: () => {
    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(30000)) return Utils.json({ ok: false, error: 'Could not acquire lock for trigger setup' });

      TriggersService.clearAll();
      
      const ss = Utils.getSS();
      const settings = SettingsService.getMap();

      // 1. Hourly Maintenance (Archiving & Stats Sync)
      ScriptApp.newTrigger('hourlyMaintenance')
        .timeBased()
        .everyHours(1)
        .create();

      // 2. WhatsApp Bridge Heartbeat (Every 15 mins)
      ScriptApp.newTrigger('checkBridgeHeartbeat')
        .timeBased()
        .everyMinutes(15)
        .create();

      // 3. Payment Timeouts (Every 5 mins)
      ScriptApp.newTrigger('checkPaymentTimeouts')
        .timeBased()
        .everyMinutes(5)
        .create();

      // 4. Daily Report (Every morning at 8:00)
      ScriptApp.newTrigger('generateDailyFinanceReport')
        .timeBased()
        .atHour(8)
        .nearMinute(0)
        .everyDays(1)
        .create();

      // 5. Daily Backup (Midnight)
      ScriptApp.newTrigger('backupSystem')
        .timeBased()
        .atHour(0)
        .nearMinute(0)
        .everyDays(1)
        .create();

      // 6. [NEW] Real-time Manual Edit Sync (Installable)
      ScriptApp.newTrigger('onEditInstallable')
        .forSpreadsheet(ss)
        .onEdit()
        .create();

      // 7. [NEW] Daily Archive (Nightly 04:00)
      ScriptApp.newTrigger('runDailyArchive')
        .timeBased()
        .atHour(4)
        .nearMinute(0)
        .everyDays(1)
        .create();

      // [NEW] Firebase Backup (Nightly 04:30)
      ScriptApp.newTrigger('backupFirebaseData')
        .timeBased()
        .atHour(4)
        .nearMinute(30)
        .everyDays(1)
        .create();

      // 8. [PERFORMANCE] Warm-Up Trigger (Every 30 minutes to prevent cold starts)
      ScriptApp.newTrigger('warmUp')
        .timeBased()
        .everyMinutes(30)
        .create();

      // 9. [RETENTION] Frequent Check (Every 10 mins) - End of Ride
      ScriptApp.newTrigger('checkRetentionFrequent')
        .timeBased()
        .everyMinutes(10)
        .create();

      // 10. [RETENTION] Daily Check (10:00 AM) - Long term retention
      ScriptApp.newTrigger('runDailyRetention')
        .timeBased()
        .atHour(10)
        .nearMinute(0)
        .everyDays(1)
        .create();

      // 11. [MAP CLEANUP] Removal of old completed orders (Every 10 mins)
      ScriptApp.newTrigger('cleanupOldFirebaseOrders')
        .timeBased()
        .everyMinutes(10)
        .create();

      Utils.log("AUDIT", "Automation Setup Completed", { triggersCount: ScriptApp.getProjectTriggers().length });
      return Utils.json({ ok: true, message: 'Automation triggers configured successfully' });
    } catch (e) {
      Utils.log("ERROR", "setupAutomation failed", e.toString());
      return Utils.error(e.toString());
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Safely clear all triggers to prevent duplicates
   */
  clearAll: () => {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      try {
        ScriptApp.deleteTrigger(t);
      } catch (e) {
        Utils.log("WARN", "Failed to delete trigger", { functionName: t.getHandlerFunction(), error: e.toString() });
      }
    });
  },

  /**
   * Self-healing check: Run periodically to ensure triggers are still there
   */
  ensureTriggersAlive: () => {
    const triggers = ScriptApp.getProjectTriggers();
    const handlers = triggers.map(t => t.getHandlerFunction());
    
    const required = ['hourlyMaintenance', 'checkBridgeHeartbeat', 'checkPaymentTimeouts', 'onEditInstallable'];
    const missing = required.filter(r => !handlers.includes(r));

    if (missing.length > 0) {
      Utils.log("WARN", "Missing critical triggers, re-initializing...", { missing });
      TriggersService.setupAutomation();
    }
  }
};

/**
 * Trigger Handler Wrapper for Payment Timeouts
 */
function checkPaymentTimeouts() {
  const settings = SettingsService.getMap();
  OrderService.checkPaymentTimeouts(settings);
}

/**
 * Trigger Handler Wrapper for Bridge Heartbeat
 */
function checkBridgeHeartbeat() {
  // [QA FIX] Use Heartbeat service and ensure it runs
  Heartbeat.checkBridge();
}

/**
 * Trigger Handler Wrapper for Daily Report
 */
function generateDailyFinanceReport() {
  const report = BillingService.getDailyReport();
  const settings = SettingsService.getMap();
  
  const reportData = JSON.parse(report.getContent()).data;
  const msg = `📊 *דוח סיכום יומי (${reportData.date})*\n\n` +
              `📦 סה"כ נסיעות: ${reportData.orders_count || reportData.orderCount || 0}\n` +
              `💰 כסף שנכנס: ${reportData.total_revenue || reportData.totalRevenue || 0} ₪\n` +
              `📈 עמלת תחנה: ${reportData.total_commission || reportData.totalCommission || reportData.commission || 0} ₪\n\n` +
              `*הדוח נשלח אוטומטית*`;

  // Send to Admin Group Telegram/WhatsApp if configured
  if (settings['TELEGRAM_CHAT_ID']) {
    NotificationService._sendToTelegramGroup(msg, settings);
  }
}

/**
 * [NEW] Handler for Manual Edits (Installable Trigger)
 * Syncs specific row changes to Firebase
 */
function onEditInstallable(e) {
    if (!e || !e.range) return;
    
    // [RELIABILITY] Throttle sync to prevent API exhaustion during bulk edits
    const editKey = 'edit_sync_' + e.range.getSheet().getName();
    if (!Utils.checkRateLimit(editKey, 10, 60)) {
        Utils.log("DEBUG", "Edit sync throttled", { sheet: e.range.getSheet().getName() });
        return;
    }

    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();
        if (row <= 1) return; // Header

        // 1. Sync Orders
        if (sheetName === 'Orders') {
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
            const idIdx = headers.indexOf('order_id');
            if (idIdx === -1) return;
            
            const orderId = sheet.getRange(row, idIdx + 1).getValue();
            if (!orderId) return;

            // Fetch full row object
            const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
            const orderObj = {};
            headers.forEach((h, i) => orderObj[h] = rowData[i]);
            
            const status = String(orderObj.status || '').toLowerCase();
            const payload = Utils.toSnakeCase(orderObj);
            
            // If cancelled, remove. If completed, keep for 5 mins (handled by forceSync/expiry)
            if (status === 'cancelled') {
                 Firebase.remove(Utils.getFirebaseOrderPath(orderId));
            } else {
                 Firebase.update(Utils.getFirebaseOrderPath(orderId), {
                    ...payload,
                    updated_at: Utils.now()
                 });
            }
        }
        
        // 2. Sync Drivers
        if (sheetName === 'Drivers') {
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
            const idIdx = headers.indexOf('driver_id');
            if (idIdx === -1) return;
             
            const driverId = sheet.getRange(row, idIdx + 1).getValue();
            if (!driverId) return;

            const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
            const driverObj = {};
            headers.forEach((h, i) => driverObj[h] = rowData[i]);
            
            const payload = Utils.toSnakeCase(driverObj);
            Firebase.update(`drivers/${driverId}`, payload);
        }


    } catch (err) {
        Utils.log("WARN", "onEditSyncFailed", err.toString());
    }
}

/**
 * [NEW] Daily Archive Trigger Handler
 */
function runDailyArchive() {
    ArchiverService.runDailyArchive();
}

/**
 * [NEW] Retention Triggers Handlers
 */
function checkRetentionFrequent() {
    RetentionService.processRecentRides();
}

function runDailyRetention() {
    RetentionService.processDailyRetention();
}

function cleanupOldFirebaseOrders() {
    OrderService.cleanupOldFirebaseOrders();
}

/**
 * Global wrapper to be visible in the Apps Script Run dropdown
 */
function runSetupAutomation() {
  return TriggersService.setupAutomation();
}


