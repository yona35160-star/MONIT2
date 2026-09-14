/**
 * SYSTEM MONITOR & HEALTH SERVICE
 * Consolidated health check, heartbeat, and recovery logic.
 */

const SystemMonitor = {
  checkAll: () => {
    const status = { bridge: SystemMonitor.checkBridge(), sheets: SystemMonitor.checkSheets() };
    SystemMonitor.updateFirebase(status);
    return status;
  },

  checkBridge: () => {
    const settings = SettingsService.getMap();
    const urls = Utils.getWhatsAppUrls(settings);
    if (!urls.length) return 'NOT_CONFIGURED';
    
    try {
      const resp = UrlFetchApp.fetch(`${urls[0]}/status`, {
        muteHttpExceptions: true,
        headers: { 'x-api-key': settings['BRIDGE_API_KEY'] }
      });
      return resp.getResponseCode() === 200 ? 'ONLINE' : 'DOWN';
    } catch (e) { return 'UNREACHABLE'; }
  },

  checkSheets: () => {
    try {
      const ss = Utils.getSS();
      return ss ? 'OK' : 'ERROR';
    } catch (e) { return 'ERROR'; }
  },

  updateFirebase: (status) => {
    if (!Firebase.isEnabled()) return;
    Firebase.update('system/health', {
      ...status,
      last_check: Date.now(),
      timestamp: new Date().toISOString()
    });
  },

  runRecovery: () => {
    Utils.log('WARN', 'SystemMonitor: Triggering recovery logic...');
    // Re-setup critical triggers if missing
    SystemMonitor.ensureTriggers();
  },

  ensureTriggers: () => {
    const triggers = ScriptApp.getProjectTriggers();
    const existing = triggers.map(t => t.getHandlerFunction());
    if (!existing.includes('runSystemHeartbeat')) {
      ScriptApp.newTrigger('runSystemHeartbeat').timeBased().everyMinutes(30).create();
    }
  }
};

function runSystemHeartbeat() { SystemMonitor.checkAll(); }
