import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileSpreadsheet,
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Globe,
  Radio,
  Settings,
  ShieldCheck,
  ArrowRight,
  Eye
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

const APPS_SCRIPT_TEMPLATE = `// ============================================================================
// CampusFlow CSE ERP - Google Live Sheet Webhook
// Paste this in Extensions > Apps Script of your Google Sheet
// ============================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Active spreadsheet not found. Ensure this script is created via Extensions > Apps Script in your Google Sheet.");
    }
    var sheet = ss.getActiveSheet() || ss.getSheets()[0];
    
    // Auto-create styled header row if empty sheet
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Student Name",
        "Enrollment",
        "Section",
        "Periods",
        "Time From",
        "Time To",
        "Date From",
        "Date To",
        "Number of Days",
        "Category",
        "Status",
        "Sanctioned By",
        "Timestamp"
      ]);
      var headerRange = sheet.getRange(1, 1, 1, 13);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1E40AF");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    // Fast response for connection tests / pings
    if (data.action === "ping" || data.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Successfully reached Google Sheet Webhook! Active sheet: " + sheet.getName(),
        sheetName: sheet.getName(),
        rows: sheet.getLastRow(),
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var records = data.records || (data.record ? [data.record] : []);
    
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      sheet.appendRow([
        r.studentName || r.applicantName || "Student",
        r.enrollment || r.rollNo || "—",
        r.section || "—",
        r.periods || "—",
        r.timeFrom || "—",
        r.timeTo || "—",
        r.dateFrom || "—",
        r.dateTo || "—",
        r.numberOfDays || 1,
        r.category || "Academic Clearance",
        r.status || "APPROVED",
        r.approvedBy || "HOD CSE",
        r.timestamp || new Date().toLocaleString()
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: records.length,
      totalRows: sheet.getLastRow(),
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "CampusFlow CSE ERP Google Sheet Sync Webhook",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

export default function GoogleSheetSyncModal({ onClose, data, totalApprovedCount }) {
  const approvedCount = totalApprovedCount ?? data?.totalApprovedCount ?? 0;

  const {
    getGoogleSheetConfig,
    saveGoogleSheetConfig,
    syncAllToGoogleSheet,
    testGoogleSheetConnection,
    addToast
  } = useERP();

  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'preview' | 'guide'
  const [sheetUrl, setSheetUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [totalSynced, setTotalSynced] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Close on ESC key & prevent background scrolling
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const config = await getGoogleSheetConfig();
        if (config) {
          setSheetUrl(config.sheetUrl || '');
          setWebhookUrl(config.webhookUrl || '');
          setAutoSyncEnabled(config.autoSyncEnabled !== false);
          setLastSyncedAt(config.lastSyncedAt || null);
          setTotalSynced(config.totalSynced || 0);
        }
      } catch (err) {
        console.error('Failed to load sheet config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await saveGoogleSheetConfig({
        sheetUrl,
        webhookUrl,
        autoSyncEnabled,
        department: 'CSE'
      });
    } catch (err) {
      addToast?.('Save Failed', err.message || 'Could not update configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) {
      addToast?.('Missing Webhook URL', 'Please enter your Google Apps Script Web App URL first.', 'warning');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGoogleSheetConnection(webhookUrl.trim());
      setTestResult({
        success: true,
        message: res?.message || 'Connection verified successfully! Google Webhook is active and listening.'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Webhook unreachable. Check deployment access (must be set to "Anyone").'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await syncAllToGoogleSheet({
        webhookUrl: webhookUrl.trim() || undefined,
        filter: 'approved'
      });
      setTotalSynced((prev) => prev + (res?.count || 0));
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      addToast?.('Sync Failed', err.message || 'Could not push records to Google Sheet.', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    addToast?.('Script Copied', 'Google Apps Script code copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper to extract embed URL from Google Sheet URL
  const getEmbedUrl = (url) => {
    if (!url) return '';
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlembed?widget=true&headers=false`;
    }
    return url;
  };

  const isConfigured = Boolean(sheetUrl || webhookUrl);

  const modalNode = (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto'
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '100%',
          maxHeight: 'calc(100vh - 2.5rem)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 'var(--radius-2xl)',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          margin: 'auto'
        }}
      >
        {/* Modal Header - Cohesive CampusFlow ERP Style */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                color: '#FFFFFF',
                flexShrink: 0
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '-0.015em'
                  }}
                >
                  Google Live Sheet Integration
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: isConfigured ? '#ECFDF5' : '#F1F5F9',
                    color: isConfigured ? '#047857' : '#64748B',
                    border: isConfigured ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isConfigured ? '#10B981' : '#94A3B8',
                      display: 'inline-block'
                    }}
                    className={isConfigured ? 'animate-pulse' : ''}
                  />
                  {isConfigured ? 'Live Connected' : 'Not Connected'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                Stream departmental approval clearances & bi-directional spreadsheet sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close modal"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs - CampusFlow Segmented Pill Container */}
        <div style={{ padding: '0.85rem 1.75rem 0.25rem 1.75rem', backgroundColor: '#FFFFFF' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--slate-100)',
              padding: '4px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              overflowX: 'auto'
            }}
          >
            {[
              { id: 'settings', label: 'Connection & Settings', icon: Settings },
              { id: 'preview', label: 'Live Sheet Viewer', icon: Eye },
              { id: 'guide', label: '30s Setup Guide', icon: Zap }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.5rem 0.85rem',
                    fontSize: '12.5px',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#065F46' : 'var(--text-secondary)',
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: active ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    justifyContent: 'center'
                  }}
                >
                  <Icon size={14} className={active ? 'text-emerald-600' : ''} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.75rem 1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-secondary)' }}>
              <RefreshCw size={26} className="animate-spin mb-2 mx-auto text-emerald-600" />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Loading Google Sheet synchronization settings...
              </p>
            </div>
          ) : activeTab === 'settings' ? (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Quick Status Banner */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: webhookUrl ? '#F0FDF4' : '#F8FAFC',
                  border: webhookUrl ? '1px solid #BBF7D0' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: webhookUrl ? '#DCFCE7' : '#E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: webhookUrl ? '#16A34A' : '#64748B',
                      flexShrink: 0
                    }}
                  >
                    <Radio size={18} className={webhookUrl && autoSyncEnabled ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {webhookUrl ? 'Live Auto-Sync Engine Ready' : 'Webhook Not Configured'}
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                      {webhookUrl
                        ? autoSyncEnabled
                          ? 'CampusFlow streams every HOD approval/rejection straight to your sheet in real-time.'
                          : 'Live auto-sync is currently paused. You can still manually sync clearances below.'
                        : 'Connect your Google Apps Script Web App URL below to activate autonomous syncing.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                      Total Synced
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A', marginTop: '1px' }}>
                      {totalSynced} records
                    </div>
                  </div>
                  {lastSyncedAt && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Last Sync
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Field 1: Google Sheet URL */}
              <div className="form-group mb-0">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={14} className="text-emerald-600" />
                    <span>1. Google Spreadsheet Link (View & Edit Link)</span>
                  </span>
                  {sheetUrl && (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '11px',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      Open Sheet in New Tab <ExternalLink size={11} />
                    </a>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    style={{ paddingLeft: '2.35rem', fontSize: '13px' }}
                  />
                  <Link2
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-tertiary)'
                    }}
                  />
                </div>
                <small className="form-helper">
                  Paste the spreadsheet address from your browser. Used for 1-click access and the Live Sheet Viewer tab.
                </small>
              </div>

              {/* Field 2: Google Apps Script Webhook URL */}
              <div className="form-group mb-0">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} className="text-amber-500" />
                    <span>2. Google Apps Script Web App URL (Live Stream Engine)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Need this URL? 30s Guide →
                  </button>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      value={webhookUrl}
                      onChange={(e) => {
                        setWebhookUrl(e.target.value);
                        setTestResult(null);
                      }}
                      style={{ paddingLeft: '2.35rem', fontSize: '13px' }}
                    />
                    <Zap
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#F59E0B'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !webhookUrl.trim()}
                    className="btn btn-outline"
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '44px',
                      padding: '0 1rem'
                    }}
                  >
                    {testing ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={14} />}
                    <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
                <small className="form-helper">
                  Deploy Web App with access set to "Anyone". Receives instant POST payloads when requests are approved.
                </small>

                {/* Test Feedback Pill */}
                {testResult && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: testResult.success ? '#ECFDF5' : '#FEF2F2',
                        border: testResult.success ? '1px solid #A7F3D0' : '1px solid #FECACA',
                        color: testResult.success ? '#065F46' : '#991B1B',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        lineHeight: 1.5
                      }}
                    >
                      {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                      <span style={{ fontWeight: 500 }}>{testResult.message}</span>
                    </div>

                    {!testResult.success && testResult.message?.includes('doPost') && (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          color: '#92400E',
                          fontSize: '12px',
                          lineHeight: 1.5
                        }}
                      >
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <Zap size={14} className="text-amber-600" />
                          <span>Quick 3-Click Fix in Google Apps Script:</span>
                        </div>
                        <ol style={{ margin: '4px 0 0 1.25rem', padding: 0, fontSize: '11.5px', color: '#78350F' }}>
                          <li>In your Google Sheet, open <strong>Extensions &gt; Apps Script</strong> and press <code>Ctrl + S</code> to save code.</li>
                          <li>Click <strong>Deploy</strong> at top right &gt; <strong>Manage deployments</strong>.</li>
                          <li>Click the <strong>✏️ Edit (pencil)</strong> icon next to the active Web app.</li>
                          <li>Under <strong>Version</strong>, select <strong>"New version"</strong> (this is required whenever script is changed).</li>
                          <li>Ensure <strong>Who has access</strong> is set to <strong>"Anyone"</strong>, then click <strong>Deploy</strong>.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Field 3: Auto-Sync Switch */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Enable Automatic Live Stream
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Whenever you approve or reject a student request in the HOD dashboard, instantly append the row to Google Sheets.
                  </div>
                </div>

                <label className="switch-toggle" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={syncingAll || !webhookUrl.trim()}
                  className="btn btn-outline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderColor: '#10B981',
                    color: '#047857'
                  }}
                  id="btn-sync-all-records-now"
                >
                  <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
                  <span>
                    {syncingAll ? 'Syncing Records...' : `Sync All Approved (${approvedCount}) to Sheet Now`}
                  </span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-success"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                    id="btn-save-google-sheet-settings"
                  >
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                    <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : activeTab === 'preview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '440px', gap: '0.75rem' }}>
              {sheetUrl ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} className="animate-pulse" />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Live Google Spreadsheet Frame</span>
                    </div>
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <span>Open in Google Sheets</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minHeight: '440px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xl)',
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <iframe
                      src={getEmbedUrl(sheetUrl)}
                      title="Google Live Sheet"
                      style={{ width: '100%', height: '100%', minHeight: '440px', border: 'none' }}
                      allowFullScreen
                    />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '4rem 1.5rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px dashed var(--border-subtle)'
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem auto'
                    }}
                  >
                    <FileSpreadsheet size={28} />
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    No Google Spreadsheet Linked Yet
                  </h4>
                  <p style={{ fontSize: '12px', maxWidth: '380px', margin: '8px auto 20px auto', lineHeight: 1.5 }}>
                    Enter your Google Sheet URL in the <strong>Connection & Settings</strong> tab to view and audit spreadsheet records right here.
                  </p>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="btn btn-sm btn-success"
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    Go to Connection Settings
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 30s Quick Setup Guide Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <Zap size={20} className="text-emerald-600 shrink-0" />
                <div style={{ fontSize: '12px', color: '#065F46', lineHeight: 1.45 }}>
                  <strong>How it works:</strong> Google Sheets includes a built-in webhook engine via Google Apps Script. 
                  By pasting this script once, your spreadsheet gains a secure endpoint that CampusFlow ERP pushes clearance rows to automatically.
                </div>
              </div>

              {/* 4 Step Visual Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {[
                  { step: '1', title: 'Open Apps Script', desc: 'In your Google Sheet, click Extensions > Apps Script in the top menu.' },
                  { step: '2', title: 'Paste & Save Code', desc: 'Clear any default code, paste the template below, and press Ctrl + S.' },
                  { step: '3', title: 'Deploy New Version', desc: 'Click Deploy > Manage deployments > ✏️ Edit > Version: "New version" > Access: "Anyone" > Deploy.' },
                  { step: '4', title: 'Paste Webhook URL', desc: 'Copy the Web app URL (ending in /exec) and paste it into Webhook URL in Settings.' }
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      padding: '0.9rem',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {s.step}
                      </span>
                      <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{s.title}</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.45 }}>
                      {s.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Script Code Block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Google Apps Script Code (Auto-Headers + Real-time Row Append)
                  </label>
                  <button
                    onClick={handleCopyScript}
                    className="btn btn-sm btn-outline"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '0.3rem 0.75rem',
                      borderColor: copied ? '#10B981' : undefined,
                      color: copied ? '#059669' : undefined
                    }}
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Apps Script Code'}</span>
                  </button>
                </div>
                <pre
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#E2E8F0',
                    padding: '1rem',
                    borderRadius: 'var(--radius-xl)',
                    fontSize: '11px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    overflowX: 'auto',
                    maxHeight: '220px',
                    margin: 0,
                    border: '1px solid #1E293B',
                    lineHeight: 1.5
                  }}
                >
                  {APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="btn btn-sm btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}
                >
                  <span>Enter Webhook in Settings</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
