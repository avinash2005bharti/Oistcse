// ============================================================================
// Google Live Sheet Synchronization Service - CampusFlow CSE ERP
// Allows HOD to link a Google Live Spreadsheet and stream approvals live
// ============================================================================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { logger } = require('./loggerService');

const OLD_CONFIG_PATH = path.join(__dirname, '../../uploads/google_sheet_sync.json');
const CONFIG_PATH = path.join(__dirname, '../../data/google_sheet_sync.json');

// In-memory cache with fallback to disk persistence
let syncConfig = {
  sheetUrl: '',
  webhookUrl: '',
  autoSyncEnabled: true,
  lastSyncedAt: null,
  totalSynced: 0,
  department: 'CSE'
};

// Auto-migrate from public uploads to secure data directory and load config (SEC-03)
try {
  const dataDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // One-time migration from uploads to secure data directory
  if (fs.existsSync(OLD_CONFIG_PATH)) {
    logger.info(`[GoogleSheetSync] Migrating config from public uploads to secure data directory.`);
    const oldRaw = fs.readFileSync(OLD_CONFIG_PATH, 'utf8');
    fs.writeFileSync(CONFIG_PATH, oldRaw, 'utf8');
    try {
      fs.unlinkSync(OLD_CONFIG_PATH);
    } catch (unlinkErr) {
      logger.warn(`[GoogleSheetSync] Could not delete old config from uploads: ${unlinkErr.message}`);
    }
  }

  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    syncConfig = { ...syncConfig, ...JSON.parse(raw) };
  }
} catch (err) {
  logger.warn(`[GoogleSheetSync] Error loading/migrating config: ${err.message}`);
}

function persistConfig() {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(syncConfig, null, 2), 'utf8');
  } catch (err) {
    logger.error(`[GoogleSheetSync] Failed to persist config: ${err.message}`);
  }
}

function validateWebhookResponse(response) {
  const data = response?.data;
  if (!data) {
    throw new Error('Google Apps Script returned an empty response.');
  }

  if (typeof data === 'string') {
    if (data.includes('Script function not found: doPost') || data.includes('Script function not found')) {
      throw new Error(
        "Google Apps Script error: 'Script function not found: doPost'. Your Web App deployment is running an older/empty version. In your Google Sheet, open Extensions > Apps Script, paste the updated code, click Deploy > Manage deployments > click the Edit pencil icon > set Version to 'New version' > click Deploy."
      );
    }
    if (data.includes('accounts.google.com') || data.includes('Sign in')) {
      throw new Error(
        "Google Apps Script access error: The Web App requires Google sign-in. In Apps Script, click Deploy > Manage deployments > Edit > set 'Who has access' to 'Anyone' (not 'Only myself')."
      );
    }
    if (data.includes('<title>Error</title>') || data.includes('errorMessage')) {
      throw new Error(
        "Google Apps Script execution error: The script returned an HTML error. In your Google Sheet, open Extensions > Apps Script, save the code, and deploy a 'New version' under Manage deployments."
      );
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.status === 'error') {
        throw new Error(`Google Apps Script error: ${parsed.error || 'Unknown error'}`);
      }
      return parsed;
    } catch (e) {
      if (e.message.includes('Google Apps Script')) throw e;
      throw new Error(`Unexpected response from Google Apps Script Webhook: ${data.slice(0, 120)}...`);
    }
  }

  if (typeof data === 'object') {
    if (data.status === 'error') {
      throw new Error(`Google Apps Script error: ${data.error || 'Execution failed'}`);
    }
    return data;
  }

  return data;
}

class GoogleSheetSyncService {
  getConfig() {
    return { ...syncConfig };
  }

  saveConfig(newConfig = {}) {
    syncConfig = {
      ...syncConfig,
      sheetUrl: typeof newConfig.sheetUrl === 'string' ? newConfig.sheetUrl.trim() : syncConfig.sheetUrl,
      webhookUrl: typeof newConfig.webhookUrl === 'string' ? newConfig.webhookUrl.trim() : syncConfig.webhookUrl,
      autoSyncEnabled: typeof newConfig.autoSyncEnabled === 'boolean' ? newConfig.autoSyncEnabled : syncConfig.autoSyncEnabled,
      department: newConfig.department || syncConfig.department || 'CSE'
    };
    persistConfig();
    logger.info(`[GoogleSheetSync] Config updated. AutoSync: ${syncConfig.autoSyncEnabled}, SheetLinked: ${Boolean(syncConfig.sheetUrl)}`);
    return { ...syncConfig };
  }

  formatRecord(record, action = 'APPROVED') {
    const studentUser = record.student?.user || {};
    let studentName = record.studentName || record.applicantName || studentUser.name;
    if (!studentName && record.student) {
      studentName = `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim();
    }
    if (!studentName && record.teacher) {
      studentName = `${record.teacher.firstName || ''} ${record.teacher.lastName || ''}`.trim() || 'Faculty Member';
    }
    studentName = studentName || 'Student';

    let rollNo = record.rollNo || record.enrollmentNo || record.student?.enrollmentNo || record.student?.rollNo;
    if (!rollNo && record.teacher) {
      rollNo = record.teacher.employeeId || 'FACULTY';
    }
    rollNo = rollNo || '—';
    const enrollment = rollNo;

    const section = (typeof record.section === 'object' && record.section ? record.section.name : record.section) 
      || record.student?.section?.name 
      || 'A';

    // Handle nested periods object if present
    const periodsObj = typeof record.periods === 'object' && record.periods !== null ? record.periods : {};
    const selectedPeriods = Array.isArray(record.selectedPeriods) && record.selectedPeriods.length > 0 
      ? record.selectedPeriods 
      : (Array.isArray(periodsObj.selectedPeriods) ? periodsObj.selectedPeriods : []);
    const timingStr = record.periodsTiming || periodsObj.periodsTiming || '';
    const periodsCount = record.approvedPeriodsCount || periodsObj.periodsCount;

    let periods = '1 Period';
    if (selectedPeriods.length > 0) {
      periods = selectedPeriods.map(p => typeof p === 'object' ? (p.label || p.time || p.id) : p).join(', ');
    } else if (timingStr) {
      periods = timingStr;
    } else if (periodsCount) {
      periods = `${periodsCount} Periods`;
    } else if (record.leaveType || record.type === 'leave_request') {
      periods = 'All Periods';
    }

    let timeFrom = '09:00 AM';
    let timeTo = '05:00 PM';
    if (timingStr) {
      const timeMatches = timingStr.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/g);
      if (timeMatches && timeMatches.length >= 2) {
        timeFrom = timeMatches[0];
        timeTo = timeMatches[timeMatches.length - 1];
      } else if (timeMatches && timeMatches.length === 1) {
        timeFrom = timeMatches[0];
        timeTo = timeMatches[0];
      }
    } else if (record.leaveType || record.type === 'leave_request') {
      timeFrom = 'Full Day';
      timeTo = 'Full Day';
    }

    const startRaw = record.startDate || record.date || record.createdAt;
    const endRaw = record.endDate || record.date || record.startDate || record.createdAt;
    const sDate = startRaw ? new Date(startRaw) : new Date();
    const eDate = endRaw ? new Date(endRaw) : sDate;

    const dateFrom = !isNaN(sDate.getTime()) ? `${String(sDate.getDate()).padStart(2, '0')}/${String(sDate.getMonth() + 1).padStart(2, '0')}/${sDate.getFullYear()}` : '—';
    const dateTo = !isNaN(eDate.getTime()) ? `${String(eDate.getDate()).padStart(2, '0')}/${String(eDate.getMonth() + 1).padStart(2, '0')}/${eDate.getFullYear()}` : dateFrom;

    let numberOfDays = 1;
    if (record.totalDays) {
      numberOfDays = Number(record.totalDays);
    } else if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      const diff = Math.max(0, eDate.getTime() - sDate.getTime());
      numberOfDays = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
    }

    let category = 'Academic Clearance';
    if (record.category && record.category !== 'attendance_consideration') {
      category = record.category;
    } else if (record.leaveType || record.type === 'leave_request') {
      category = `Student Leave (${record.leaveType || 'General'})`;
    } else if (record.type === 'attendance_consideration' || record.category === 'attendance_consideration') {
      category = 'Attendance Consideration (OD/Duty)';
    } else if (record.type === 'attendance_query' || record.queryNote) {
      category = `Attendance Dispute Query (${record.subjectName || record.subject?.name || 'Session'})`;
    }

    const dates = `${dateFrom} to ${dateTo}`;
    const reason = record.reason || record.title || record.queryNote || 'Particulars submitted by student';
    const remarks = record.hodRemarks || record.tgRemarks || record.comments || 'Sanctioned by HOD CSE via CampusFlow ERP';

    return {
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      id: record.id || `REQ-${Date.now()}`,
      studentName,
      rollNo,
      enrollment,
      section,
      periods,
      timeFrom,
      timeTo,
      dateFrom,
      dateTo,
      numberOfDays,
      category,
      dates,
      reason,
      status: action.toUpperCase(),
      approvedBy: 'Head of Department (HOD CSE)',
      remarks
    };
  }

  async syncRecord(record, action = 'APPROVED') {
    if (!syncConfig.webhookUrl || !syncConfig.autoSyncEnabled) {
      return { synced: false, reason: 'Webhook URL not configured or Auto-Sync disabled' };
    }

    const formatted = this.formatRecord(record, action);

    try {
      logger.info(`[GoogleSheetSync] Dispatching live record ${formatted.id} to Google Sheet Webhook`);
      const response = await axios.post(
        syncConfig.webhookUrl,
        {
          action: 'sync_record',
          record: formatted,
          records: [formatted],
          timestamp: new Date().toISOString()
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 12000,
          maxRedirects: 10
        }
      );

      const validated = validateWebhookResponse(response);
      syncConfig.lastSyncedAt = new Date().toISOString();
      syncConfig.totalSynced = (syncConfig.totalSynced || 0) + 1;
      persistConfig();

      logger.info(`[GoogleSheetSync] Record ${formatted.id} synced successfully to Google Sheet.`);
      return { synced: true, response: validated };
    } catch (err) {
      logger.warn(`[GoogleSheetSync] Live sync failed for record ${formatted.id}: ${err.message}`);
      return { synced: false, error: err.message };
    }
  }

  async syncBatch(records = [], customWebhookUrl = null) {
    const url = customWebhookUrl || syncConfig.webhookUrl;
    if (!url) {
      throw new Error('Google Sheet Webhook URL is not configured. Please link your Google Sheet Webhook first.');
    }

    const formattedBatch = records.map((r) => this.formatRecord(r, r.status || 'APPROVED'));

    try {
      logger.info(`[GoogleSheetSync] Syncing batch of ${formattedBatch.length} records to Google Sheet`);
      const response = await axios.post(
        url,
        {
          action: 'sync_batch',
          records: formattedBatch,
          count: formattedBatch.length,
          timestamp: new Date().toISOString()
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          maxRedirects: 10
        }
      );

      const validated = validateWebhookResponse(response);
      syncConfig.lastSyncedAt = new Date().toISOString();
      syncConfig.totalSynced = (syncConfig.totalSynced || 0) + formattedBatch.length;
      persistConfig();

      return {
        success: true,
        count: formattedBatch.length,
        response: validated
      };
    } catch (err) {
      logger.error(`[GoogleSheetSync] Batch sync failed: ${err.message}`);
      throw new Error(`Failed to sync to Google Sheet: ${err.message}`);
    }
  }

  async testConnection(testUrl = null) {
    const url = testUrl || syncConfig.webhookUrl;
    if (!url) {
      throw new Error('No Webhook URL provided to test.');
    }

    try {
      const response = await axios.post(
        url,
        {
          action: 'ping',
          test: true,
          timestamp: new Date().toISOString()
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          maxRedirects: 10
        }
      );

      const validated = validateWebhookResponse(response);
      return {
        connected: true,
        message: validated.message || 'Successfully reached Google Sheet Apps Script Webhook!',
        data: validated
      };
    } catch (err) {
      throw new Error(`Connection test failed: ${err.message}`);
    }
  }
}

module.exports = new GoogleSheetSyncService();
