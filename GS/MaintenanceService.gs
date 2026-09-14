/**
 * MAINTENANCE SERVICE
 * Consolidated data retention, archiver, and backup logic.
 */

const MaintenanceService = {
  runDaily: () => {
    Utils.log('INFO', 'Maintenance: Starting daily tasks...');
    MaintenanceService.runArchive();
    MaintenanceService.runCleanup();
    MaintenanceService.runBackup();
  },

  runArchive: () => {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) return;
    try {
      const ss = Utils.getSS();
      const ordersSheet = ss.getSheetByName('Orders');
      if (!ordersSheet || ordersSheet.getLastRow() < 2) return;
      
      const data = ordersSheet.getDataRange().getValues();
      const headers = data[0].map(Utils.normalizeHeader);
      const statusIdx = headers.indexOf('status');
      const updatedIdx = headers.indexOf('updated_at');
      
      const now = new Date().getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const rowsToMove = [];
      const rowsToKeep = [data[0]];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = String(row[statusIdx]).toLowerCase();
        const updated = row[updatedIdx] ? new Date(row[updatedIdx]).getTime() : 0;
        if (['completed', 'cancelled'].includes(status) && (now - updated > dayMs)) {
          rowsToMove.push(row);
        } else {
          rowsToKeep.push(row);
        }
      }

      if (rowsToMove.length > 0) {
        const archiveName = `Archive_${new Date().getFullYear()}`;
        let archive = ss.getSheetByName(archiveName) || ss.insertSheet(archiveName);
        if (archive.getLastRow() === 0) archive.appendRow(data[0]);
        archive.getRange(archive.getLastRow() + 1, 1, rowsToMove.length, rowsToMove[0].length).setValues(rowsToMove);
        ordersSheet.clearContents().getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
      }
    } finally { lock.releaseLock(); }
  },

  runCleanup: () => {
    // Retention Logic: Clear old logs or temp data
    const logs = Utils.getSS().getSheetByName('Audit_Log');
    if (logs && logs.getLastRow() > 5000) {
      logs.deleteRows(2, logs.getLastRow() - 1000);
    }
  },

  runBackup: () => {
    try {
      const file = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
      const folder = DriveApp.getFoldersByName('TaxiWork_Backups').hasNext() ? 
                     DriveApp.getFoldersByName('TaxiWork_Backups').next() : 
                     DriveApp.createFolder('TaxiWork_Backups');
      file.makeCopy(`Backup_${new Date().toISOString().split('T')[0]}`, folder);
    } catch(e) { console.error('Backup failed', e); }
  }
};

/** Triggers */
function doDailyMaintenance() { MaintenanceService.runDaily(); }
