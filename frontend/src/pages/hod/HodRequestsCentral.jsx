import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import RequestCard from '../../components/RequestCard';
import HodRequestCard from '../../components/HodRequestCard';
import GoogleSheetSyncModal from '../../components/modals/GoogleSheetSyncModal';
import AttendanceLeaveReportsModal from '../../components/modals/AttendanceLeaveReportsModal';
import { PageHeader, Badge, Button, Card, EmptyState } from '../../components/common';
import {
  exportLedgerToExcel,
  exportLedgerToCSV,
  printLedgerReport
} from '../../utils/reportExportUtils';
import {
  Compass,
  Filter,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckSquare,
  Radio,
  Sparkles,
  Layers
} from 'lucide-react';

const getApprovedPeriodDetails = (request) => {
  if (request.type !== 'attendance_consideration') {
    return { count: '—', timing: '—' };
  }

  const periods = Array.isArray(request.selectedPeriods)
    ? request.selectedPeriods
    : Array.isArray(request.periods)
      ? request.periods
      : [];
  const count = request.approvedPeriodsCount ?? request.periodsCount ?? (periods.length || '—');
  const timing = request.periodsTiming || (periods.length
    ? periods.map((period) => (
      typeof period === 'object' ? period?.time || period?.label || period?.id || '' : period
    )).filter(Boolean).join(', ')
    : '—');

  return { count, timing };
};

export default function HodRequestsCentral() {
  const {
    attendanceRequests,
    leaveRequests,
    attendanceQueries,
    hodApproveAttendanceConsideration,
    hodRejectAttendanceConsideration,
    hodApproveLeave,
    hodRejectLeave,
    hodApproveAttendanceQuery,
    hodRejectAttendanceQuery,
    addToast
  } = useERP();

  const [filter, setFilter] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [periodAdjustments, setPeriodAdjustments] = useState({});

  const allRequests = [
    ...attendanceRequests.map((r) => ({ ...r, type: 'attendance_consideration' })),
    ...leaveRequests.map((l) => ({ ...l, type: 'leave_request' })),
    ...attendanceQueries.map((q) => ({
      ...q,
      title: `Attendance Query: ${q.subjectName || q.subject || 'Dispute'}`,
      type: 'attendance_query'
    }))
  ];

  const isAccepted = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'approved' || s === 'completed' || s === 'approved_by_hod';
  };

  const isAwaitingHod = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'pending_hod' || s === 'pending_hod_direct' || s === 'recommended_by_tg';
  };

  const isPendingTg = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'pending' || s === 'pending_tg';
  };

  const allAccepted = allRequests.filter((r) => isAccepted(r.status));

  const filtered = allRequests.filter((r) => {
    const semMatches = selectedSemester === 'ALL' || String(r.semester) === String(selectedSemester);
    if (!semMatches) return false;
    if (filter === 'pending') return isAwaitingHod(r.status);
    if (filter === 'bypass') return isPendingTg(r.status);
    if (filter === 'leaves') return r.type === 'leave_request';
    if (filter === 'considerations') return r.type === 'attendance_consideration';
    if (filter === 'approved') return isAccepted(r.status);
    return true;
  });

  const getExportList = (customList) => {
    let list = customList || allAccepted;
    if (selectedSemester !== 'ALL') {
      list = list.filter((r) => String(r.semester) === String(selectedSemester));
    }
    return list;
  };

  // Multi-format Official Clearances Ledger Downloads per Image Architecture
  const handleExportCsv = (list) => {
    const targetList = getExportList(list);
    if (!targetList || targetList.length === 0) {
      addToast?.('No Records', 'There are no approved requests to export for the selected semester.', 'warning');
      return;
    }
    exportLedgerToCSV({ records: targetList, semester: selectedSemester });
    addToast?.('CSV Export Complete', `Downloaded ${targetList.length} approved record(s) as CSV.`, 'success');
  };

  const handleExportExcel = (list) => {
    const targetList = getExportList(list);
    if (!targetList || targetList.length === 0) {
      addToast?.('No Records', 'There are no approved requests to export for the selected semester.', 'warning');
      return;
    }
    exportLedgerToExcel({
      records: targetList,
      semester: selectedSemester,
      authorizedBy: 'Head of Department (HOD CSE)'
    });
    addToast?.('Excel Export Complete', `Downloaded ${targetList.length} approved record(s) as Excel file.`, 'success');
  };

  const handlePrintReport = (list) => {
    const targetList = getExportList(list);
    if (!targetList || targetList.length === 0) {
      addToast?.('No Records', 'There are no approved requests to print for the selected semester.', 'warning');
      return;
    }
    printLedgerReport({
      records: targetList,
      semester: selectedSemester,
      authorizedBy: 'Head of Department (HOD CSE)'
    });
    addToast?.('Print Report Opened', `Prepared official print / PDF report for ${targetList.length} record(s).`, 'info');
  };

  const handleApproveAction = async (req, customPeriods) => {
    try {
      const finalPeriods = customPeriods ?? periodAdjustments[req.id] ?? req.periodsCount ?? 4;
      if (req.type === 'attendance_consideration') {
        await hodApproveAttendanceConsideration(req.id, req.status === 'pending_tg', {
          approvedPeriodsCount: finalPeriods,
          comments: `Sanctioned by HOD CSE: ${finalPeriods} consideration lecture periods credited.`
        });
      } else if (req.type === 'leave_request' || req.leaveType) {
        await hodApproveLeave(req.id, req.status === 'pending_tg');
      } else {
        await hodApproveAttendanceQuery(req.id);
      }
      addToast?.(
        'Request Cleared',
        `Approval recorded successfully${req.type === 'attendance_consideration' ? ` (${finalPeriods} consideration periods sanctioned)` : ''}.`,
        'success'
      );
    } catch (err) {
      addToast?.('Action Failed', err.message || 'Could not record approval.', 'error');
    }
  };

  return (
    <div className="page-wrapper">
      <div className="flex flex-col gap-5">
        {/* Top Header with Multi-Format Download Buttons */}
        <PageHeader
          title="Department Requests & Approvals Central"
          description="Central repository of attendance considerations, student leave applications, and attendance dispute queries with direct TG bypass authority."
          badge={<Badge variant="purple" size="sm">HOD Digital Sign-off</Badge>}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Semester Filter Selector (Per Diagram Architecture) */}
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
                <span className="font-bold text-slate-700">Semester:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-primary outline-none cursor-pointer"
                  id="hod-select-semester-filter"
                >
                  <option value="ALL">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Full Clearances Ledger Modal */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReportsModal(true)}
                id="btn-requests-view-ledger-modal"
                leftIcon={<Layers size={15} className="text-indigo-600" />}
              >
                Clearances Ledger
              </Button>

              {/* Google Live Sheet Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGoogleSheetModal(true)}
                id="btn-requests-google-live-sheet"
                leftIcon={<FileSpreadsheet size={15} className="text-emerald-600" />}
                rightIcon={
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    LIVE
                  </span>
                }
              >
                Google Live Sheet
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportExcel()}
                disabled={allAccepted.length === 0}
                id="btn-requests-download-excel"
                leftIcon={<FileSpreadsheet size={15} className="text-emerald-600" />}
                rightIcon={<Badge variant="success" size="xs">{allAccepted.length}</Badge>}
              >
                Export Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv()}
                disabled={allAccepted.length === 0}
                id="btn-requests-download-csv"
                leftIcon={<Download size={15} />}
              >
                CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrintReport()}
                disabled={allAccepted.length === 0}
                id="btn-requests-print-report"
                leftIcon={<Printer size={15} className="text-primary-600" />}
              >
                Print Report
              </Button>
            </div>
          }
        />

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All Requests (${allRequests.length})` },
            { id: 'pending', label: `Awaiting HOD Sign-off (${allRequests.filter((r) => isAwaitingHod(r.status)).length})` },
            { id: 'bypass', label: `⚡ Direct Bypass Queue (${allRequests.filter((r) => isPendingTg(r.status)).length})` },
            { id: 'leaves', label: `Leave Applications (${allRequests.filter((r) => r.type === 'leave_request').length})` },
            { id: 'considerations', label: `Considerations (${allRequests.filter((r) => r.type === 'attendance_consideration').length})` },
            { id: 'approved', label: `Cleared & Synced (${allAccepted.length})` }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filter === f.id
                  ? 'bg-primary text-white border-primary shadow-xs font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
              id={`filter-pill-${f.id}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Dedicated Banner when Approved Tab is Selected */}
        {filter === 'approved' && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: '#ECFDF5',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CheckCircle2 size={20} className="text-emerald-600" />
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#065F46', margin: 0 }}>
                  Official Approved & Synced Clearances Register ({filtered.length} records)
                </h4>
                <p style={{ fontSize: '11px', color: '#047857', margin: '2px 0 0 0' }}>
                  All sanctioned leaves, duty considerations, and dispute corrections ready for spreadsheet export and departmental auditing.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setShowGoogleSheetModal(true)}
                className="btn btn-sm btn-outline-success"
                style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#FFFFFF' }}
              >
                <FileSpreadsheet size={13} className="me-1 text-emerald-600" />
                Live Google Sheet
              </button>
              <button
                onClick={() => handleExportExcel(filtered)}
                className="btn btn-sm btn-success"
                style={{ fontSize: '11px', fontWeight: 700 }}
              >
                <FileSpreadsheet size={13} className="me-1" />
                Export Selected (Excel)
              </button>
              <button
                onClick={() => handleExportCsv(filtered)}
                className="btn btn-sm btn-outline-success"
                style={{ fontSize: '11px', fontWeight: 700, background: '#FFFFFF' }}
              >
                <Download size={13} className="me-1" />
                Export CSV
              </button>
            </div>
          </div>
        )}

        {/* List with Interactive Actions enabled */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.length === 0 ? (
            <div className="card text-center p-8 text-slate-400 text-xs">
              No requests match the selected filter.
            </div>
          ) : (
            filtered.map((req) => {
              const normStatus = String(req.status || '').toLowerCase();
              const isActionable = !['completed', 'approved', 'rejected', 'approved_by_hod'].includes(normStatus);
              const currentPeriods =
                periodAdjustments[req.id] ??
                req.approvedPeriodsCount ??
                req.periodsCount ??
                (Array.isArray(req.selectedPeriods)
                  ? req.selectedPeriods.length
                  : Array.isArray(req.periods)
                    ? req.periods.length
                    : 3);

              return (
                <HodRequestCard
                  key={req.id}
                  request={{
                    ...req,
                    periodsCount: currentPeriods,
                    approvedPeriodsCount: req.approvedPeriodsCount || (normStatus === 'approved' ? currentPeriods : undefined)
                  }}
                  currentPeriods={currentPeriods}
                  onPeriodChange={(newCount) => {
                    setPeriodAdjustments((prev) => ({ ...prev, [req.id]: newCount }));
                  }}
                  showActions={isActionable}
                  onApprove={() => handleApproveAction(req, currentPeriods)}
                  onReject={() => {
                    if (req.type === 'attendance_consideration') {
                      hodRejectAttendanceConsideration(req.id);
                    } else if (req.type === 'leave_request' || req.leaveType) {
                      hodRejectLeave(req.id);
                    } else if (req.type === 'attendance_query') {
                      hodRejectAttendanceQuery(req.id);
                    }
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Google Live Sheet Sync Modal */}
      {showGoogleSheetModal && (
        <GoogleSheetSyncModal
          onClose={() => setShowGoogleSheetModal(false)}
          totalApprovedCount={allAccepted.length}
        />
      )}

      {/* Official Clearances Ledger Modal */}
      {showReportsModal && (
        <AttendanceLeaveReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          initialSemester={selectedSemester}
          userRole="hod"
        />
      )}
    </div>
  );
}
