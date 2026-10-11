import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import RequestCard from '../../components/RequestCard';
import { FileText, CheckCircle2, UserCheck, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default function TgRequests() {
  const {
    attendanceRequests,
    leaveRequests,
    attendanceQueries,
    tgReviewAttendanceConsideration,
    tgRejectAttendanceConsideration,
    tgReviewAttendanceQuery,
    tgRejectAttendanceQuery,
    tgReviewLeave,
    tgRejectLeave,
    currentUser,
    openModal
  } = useERP();

  const [activeTab, setActiveTab] = useState('attendance');

  const isAwaitingTg = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'pending' || s === 'pending_tg';
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Student Requests & Mentorship Approvals
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              1st-tier verification pipeline before forwarding to Head of Department
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => openModal('attendanceLeaveReports', { role: 'tg', initialTab: activeTab === 'leave' ? 'leaves' : 'attendance' })}
              className="btn btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
              style={{ borderColor: '#3B82F6', color: '#1D4ED8', backgroundColor: '#EFF6FF', fontWeight: 700 }}
              id="btn-tg-requests-reports-ledger"
            >
              <FileSpreadsheet size={14} className="text-blue-600" />
              <span>Clearances Ledger &amp; Reports</span>
            </button>

            <button
              onClick={() => openModal('googleSheet')}
              className="btn btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
              style={{ borderColor: '#10B981', color: '#047857', backgroundColor: '#ECFDF5' }}
              id="btn-tg-requests-google-sheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Live Google Sheet</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            </button>
          </div>
        </div>

        {/* Request Category Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface-high)',
            borderRadius: 'var(--radius-full)',
            padding: '4px',
            gap: '4px',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'attendance', label: `Attendance Considerations (${attendanceRequests.length})` },
            { id: 'queries', label: `Attendance Queries (${attendanceQueries.length})` },
            { id: 'leave', label: `Leave Applications (${leaveRequests.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                backgroundColor: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {activeTab === 'attendance' && (
            attendanceRequests.length === 0 ? (
              <div className="card text-center" style={{ padding: '2.5rem', color: 'var(--text-secondary)' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No records found.</h3>
                <p style={{ fontSize: '13px', margin: '0.25rem 0 0' }}>No attendance consideration requests submitted yet.</p>
              </div>
            ) : (
              attendanceRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  showActions={isAwaitingTg(req.status)}
                  role="tg"
                  onRecommend={() => tgReviewAttendanceConsideration(req.id, `Verified by Mentor ${currentUser?.name || ''}: Valid documentation verified.`)}
                  onReject={() => tgRejectAttendanceConsideration(req.id, 'Disapproved by Mentor')}
                />
              ))
            )
          )}

          {activeTab === 'queries' && (
            attendanceQueries.length === 0 ? (
              <div className="card text-center" style={{ padding: '2.5rem', color: 'var(--text-secondary)' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No records found.</h3>
                <p style={{ fontSize: '13px', margin: '0.25rem 0 0' }}>No attendance queries or disputes submitted yet.</p>
              </div>
            ) : (
              attendanceQueries.map((q) => (
                <RequestCard
                  key={q.id}
                  request={{
                    ...q,
                    title: `Attendance Query: ${q.subjectName || q.subject || 'Dispute'}`,
                    dateRangeLabel: q.dateRangeLabel || q.date
                  }}
                  showActions={isAwaitingTg(q.status)}
                  role="tg"
                  onRecommend={() => tgReviewAttendanceQuery(q.id)}
                  onReject={() => tgRejectAttendanceQuery(q.id, 'Dispute rejected by Tutor Guardian')}
                />
              ))
            )
          )}

          {activeTab === 'leave' && (
            leaveRequests.length === 0 ? (
              <div className="card text-center" style={{ padding: '2.5rem', color: 'var(--text-secondary)' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No records found.</h3>
                <p style={{ fontSize: '13px', margin: '0.25rem 0 0' }}>No student leave applications submitted yet.</p>
              </div>
            ) : (
              leaveRequests.map((lv) => (
                <RequestCard
                  key={lv.id}
                  request={lv}
                  showActions={isAwaitingTg(lv.status)}
                  role="tg"
                  onRecommend={() => tgReviewLeave(lv.id, true)}
                  onReject={() => tgRejectLeave(lv.id, 'Leave rejected by Tutor Guardian')}
                />
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
