import React from 'react';
import { useERP } from '../context/ERPContext';
import { getBackendUrl } from '../api/client';
import ApprovalStatus from './ApprovalStatus';
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
  UserCheck,
  Zap
} from 'lucide-react';

/**
 * Helper to extract formatted from, to, and days count
 */
function getDateDetails(req) {
  let fromStr = '';
  let toStr = '';
  let days = req.totalDays || null;

  const formatDate = (val) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    } catch {
      // ignore
    }
    return String(val);
  };

  if (req.startDate) fromStr = formatDate(req.startDate);
  if (req.endDate) toStr = formatDate(req.endDate);

  if (!fromStr || !toStr) {
    const rawRange = req.dateRangeLabel || req.dates || req.date || '';
    if (typeof rawRange === 'string' && rawRange.includes('-')) {
      const parts = rawRange.split('-').map((s) => s.trim());
      if (!fromStr) fromStr = parts[0] || '';
      if (!toStr) toStr = parts[1] || parts[0] || '';
    } else if (rawRange) {
      if (!fromStr) fromStr = String(rawRange);
      if (!toStr) toStr = String(rawRange);
    }
  }

  if (!toStr && fromStr) toStr = fromStr;
  if (!fromStr && toStr) fromStr = toStr;
  if (!fromStr) fromStr = '—';
  if (!toStr) toStr = '—';

  if (!days) {
    if (req.startDate && req.endDate) {
      try {
        const s = new Date(req.startDate);
        const e = new Date(req.endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          days = diffDays > 0 ? diffDays : 1;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!days && fromStr !== '—' && toStr !== '—') {
    try {
      const s = new Date(fromStr);
      const e = new Date(toStr);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        days = diffDays > 0 ? diffDays : 1;
      }
    } catch {
      // ignore
    }
  }

  if (!days) days = 1;

  return { fromStr, toStr, days };
}

/**
 * Helper to extract category text
 */
function getCategory(req) {
  if (req.category) return req.category;
  if (req.considerationType) return req.considerationType;
  if (req.leaveType) return `${req.leaveType} Leave`;
  if (req.type === 'attendance_consideration') {
    if (typeof req.reason === 'string' && req.reason.startsWith('[')) {
      const match = req.reason.match(/^\[(.*?)\]/);
      if (match && match[1]) return match[1];
    }
    return 'Medical Consideration';
  }
  if (req.type === 'leave_request') return 'Leave Application';
  if (req.type === 'attendance_query') return 'Attendance Dispute';
  return 'OD Consideration';
}

/**
 * Helper to format requested periods
 */
function getRequestedPeriodsText(req) {
  const count =
    req.periodsCount ||
    (Array.isArray(req.selectedPeriods)
      ? req.selectedPeriods.length
      : Array.isArray(req.periods)
        ? req.periods.length
        : null);

  const countStr = count ? `${count} Period${count > 1 ? 's' : ''}` : '';

  let timingStr = '';
  if (req.periodsTiming) {
    timingStr = req.periodsTiming;
  } else if (Array.isArray(req.selectedPeriods) && req.selectedPeriods.length > 0) {
    timingStr = req.selectedPeriods.join(', ');
  } else if (Array.isArray(req.periods) && req.periods.length > 0) {
    timingStr = req.periods
      .map((p) => (typeof p === 'object' ? p.time || p.label || p.id : p))
      .filter(Boolean)
      .join(', ');
  }

  if (countStr && timingStr) {
    return `${countStr} • ${timingStr}`;
  }
  if (countStr) return countStr;
  if (timingStr) return timingStr;
  if (req.type === 'leave_request') {
    return `Full Day Schedule (${req.totalDays || 1} day${(req.totalDays || 1) > 1 ? 's' : ''})`;
  }
  return 'Full Day / Standard Periods';
}

export default function HodRequestCard({
  request,
  onApprove,
  onReject,
  currentPeriods,
  onPeriodChange,
  showActions = true
}) {
  const { openModal } = useERP();
  if (!request) return null;

  const normStatus = String(request.status || '').toLowerCase();
  const isApproved = ['approved', 'completed', 'approved_hod', 'approved_by_hod'].includes(normStatus);
  const isPendingTg = normStatus === 'pending' || normStatus === 'pending_tg';

  // Extract metadata
  const { fromStr, toStr, days } = getDateDetails(request);
  const categoryText = getCategory(request);
  const requestedPeriodsText = getRequestedPeriodsText(request);

  // Default periods count
  const periodsCountValue =
    currentPeriods ??
    request.approvedPeriodsCount ??
    request.periodsCount ??
    (Array.isArray(request.selectedPeriods)
      ? request.selectedPeriods.length
      : Array.isArray(request.periods)
        ? request.periods.length
        : 3);

  // Supporting doc URL
  const proofUrl =
    request.proofDocumentUrl ||
    request.docUrl ||
    (typeof request.supportingDoc === 'string' && request.supportingDoc.includes('.') ? request.supportingDoc : null);

  // TG recommendation text
  const tgNote = request.tgRecommendation || request.tgRemarks;

  return (
    <div
      className="card hover-lift"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.25rem 1.35rem',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* ====================================================================
          1. CARD HEADER (Icon, Title, Subtitle, Status, Date meta)
          ==================================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid #C7D2FE'
              }}
            >
              <FileText size={22} />
            </div>

            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0F172A',
                  lineHeight: 1.3,
                  margin: 0
                }}
              >
                {request.title || `OD Consideration: ${categoryText}`}
              </h3>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748B',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}
              >
                <span>
                  {request.studentName ? `${request.studentName} (${request.rollNo || request.enrollmentNo || '—'})` : 'Student'}
                </span>
                <span>•</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#94A3B8' }}>
                  #{request.id}
                </span>
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <ApprovalStatus status={request.status} />
          </div>
        </div>

        {/* Date line + Resolution status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#64748B',
            paddingTop: '2px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={14} className="text-slate-400" />
            <span>
              {request.dateRangeLabel || request.dates || `${fromStr} - ${toStr}`}
            </span>
          </div>

          <div>
            {isApproved ? (
              <span style={{ color: '#059669', fontWeight: 600 }}>Completed & Synced</span>
            ) : (
              <span style={{ color: '#D97706', fontWeight: 500 }}>Est. resolution today</span>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. TWO-COLUMN SPLIT LAYOUT (LEFT: Details & Controls, RIGHT: Justifications)
          ==================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch'
        }}
      >
        {/* ==================================================================
            LEFT COLUMN: Category, Date Table, Requested Periods, Stepper, Actions
            ================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Row 1: Category Box & Date Table */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.45fr)',
              gap: '0.65rem'
            }}
          >
            {/* Box 1: Category */}
            <div
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                padding: '0.55rem 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '62px'
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px'
                }}
              >
                Category
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={categoryText}
              >
                {categoryText}
              </span>
            </div>

            {/* Box 2: Date Table */}
            <div
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header Title */}
              <div
                style={{
                  backgroundColor: '#F1F5F9',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 0',
                  borderBottom: '1px solid #CBD5E1'
                }}
              >
                Date
              </div>

              {/* 3-Column Table Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1.1fr 1.2fr',
                  fontSize: '10px',
                  color: '#64748B',
                  fontWeight: 600,
                  textAlign: 'center',
                  borderBottom: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC'
                }}
              >
                <div style={{ padding: '3px 4px', borderRight: '1px solid #E2E8F0' }}>from</div>
                <div style={{ padding: '3px 4px', borderRight: '1px solid #E2E8F0' }}>to</div>
                <div style={{ padding: '3px 4px' }}>nos of days</div>
              </div>

              {/* Data Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1.1fr 1.2fr',
                  fontSize: '11px',
                  color: '#0F172A',
                  fontWeight: 700,
                  textAlign: 'center',
                  alignItems: 'center',
                  flexGrow: 1,
                  padding: '4px 0'
                }}
              >
                <div style={{ padding: '2px 4px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                  {fromStr}
                </div>
                <div style={{ padding: '2px 4px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                  {toStr}
                </div>
                <div style={{ padding: '2px 4px', color: '#1D4ED8', fontWeight: 800 }}>
                  {days}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Requested Periods Box */}
          <div
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              padding: '0.55rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={12} className="text-blue-600" />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Requested Periods
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#1D4ED8',
                lineHeight: 1.35
              }}
            >
              {requestedPeriodsText}
            </div>
          </div>

          {/* Row 3: Sanctioned Period (default as requested) + Stepper */}
          <div
            style={{
              border: '1px solid #DDD6FE',
              borderRadius: '12px',
              backgroundColor: '#FAF5FF',
              padding: '0.55rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#581C87',
                  lineHeight: 1.2
                }}
              >
                sanctioned period
              </span>
              <span style={{ fontSize: '10px', color: '#7E22CE', fontWeight: 500 }}>
                (default as requested)
              </span>
            </div>

            {/* Stepper with - / + Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1.5px solid #C084FC',
                  padding: '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onPeriodChange && periodsCountValue > 1) {
                      onPeriodChange(periodsCountValue - 1);
                    }
                  }}
                  disabled={!showActions || periodsCountValue <= 1}
                  className="btn btn-xs"
                  style={{
                    width: '26px',
                    height: '26px',
                    padding: 0,
                    fontWeight: 800,
                    fontSize: '14px',
                    color: '#7E22CE',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#F3E8FF',
                    cursor: showActions && periodsCountValue > 1 ? 'pointer' : 'not-allowed',
                    opacity: showActions && periodsCountValue > 1 ? 1 : 0.4
                  }}
                  title="Decrease period count"
                >
                  –
                </button>
                <span
                  style={{
                    minWidth: '38px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    color: '#581C87',
                    padding: '0 4px'
                  }}
                >
                  {periodsCountValue}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onPeriodChange && periodsCountValue < 14) {
                      onPeriodChange(periodsCountValue + 1);
                    }
                  }}
                  disabled={!showActions || periodsCountValue >= 14}
                  className="btn btn-xs"
                  style={{
                    width: '26px',
                    height: '26px',
                    padding: 0,
                    fontWeight: 800,
                    fontSize: '14px',
                    color: '#7E22CE',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#F3E8FF',
                    cursor: showActions && periodsCountValue < 14 ? 'pointer' : 'not-allowed',
                    opacity: showActions && periodsCountValue < 14 ? 1 : 0.4
                  }}
                  title="Increase period count"
                >
                  +
                </button>
              </div>
              <span style={{ fontSize: '11px', color: '#7E22CE', fontWeight: 700 }}>
                Period{periodsCountValue > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Row 4: Action Buttons (Approve / Reject) OR Official Sanction view */}
          {showActions ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '2px' }}>
              <button
                type="button"
                onClick={onApprove}
                id={`btn-approve-request-${request.id}`}
                className="btn btn-sm"
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#15803D')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#16A34A')}
              >
                {isPendingTg ? <Zap size={14} color="#FFFFFF" /> : <CheckCircle2 size={14} color="#FFFFFF" />}
                <span>{isPendingTg ? 'Bypass & Approve' : 'Approve'}</span>
              </button>

              <button
                type="button"
                onClick={onReject}
                id={`btn-reject-request-${request.id}`}
                className="btn btn-sm"
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  color: '#DC2626',
                  border: '1.5px solid #FCA5A5',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <XCircle size={14} color="#DC2626" />
                <span>Reject</span>
              </button>
            </div>
          ) : isApproved ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.85rem',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#065F46' }}>
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span style={{ fontWeight: 700 }}>Sanctioned by CSE Department</span>
              </div>
              <button
                type="button"
                onClick={() => openModal('formalApplication', { request })}
                className="btn btn-xs btn-success"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '0.3rem 0.65rem'
                }}
                id={`btn-view-formal-app-${request.id}`}
              >
                <FileText size={12} />
                <span>View Order</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* ==================================================================
            RIGHT COLUMN: Justifications written by student during applying
            ================================================================== */}
        <div
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '14px',
            backgroundColor: '#F8FAFC',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
            {/* Box Header Label */}
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1.35
              }}
            >
              justifications written during applying of consideration or leave by student
            </span>

            {/* Written Justification Content */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '0.75rem',
                fontSize: '12.5px',
                color: '#334155',
                lineHeight: 1.5,
                flexGrow: 1,
                minHeight: '85px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {request.reason || 'No specific justification written by applicant.'}
            </div>
          </div>

          {/* Footer inside right column: Attached Proof & TG Note if present */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.65rem' }}>
            {/* Supporting Document Proof Link */}
            {proofUrl && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '11.5px',
                  padding: '0.4rem 0.65rem',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <FileText size={14} style={{ color: '#4F46E5' }} className="shrink-0" />
                <span style={{ fontWeight: 600, color: '#64748B' }}>Attached Proof:</span>
                <a
                  href={getBackendUrl(proofUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#4F46E5',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  id={`btn-open-doc-${request.id}`}
                >
                  <span>View Supporting Document</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            )}

            {/* TG Note */}
            {tgNote && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  backgroundColor: '#EFF6FF',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  borderLeft: '3px solid #3B82F6'
                }}
              >
                <UserCheck size={13} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span style={{ fontWeight: 700, color: '#1D4ED8' }}>TG Note: </span>
                  <span style={{ color: '#1E293B' }}>{tgNote}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
