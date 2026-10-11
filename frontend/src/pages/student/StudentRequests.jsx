import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useERP } from '../../context/ERPContext';
import RequestCard from '../../components/RequestCard';
import DocumentUploader from '../../components/common/DocumentUploader';
import { PageHeader, Card, Badge, Button, EmptyState } from '../../components/common';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Award,
  BookOpen,
  Home,
  ShieldCheck,
  Upload,
  X,
  Sparkles
} from 'lucide-react';

export default function StudentRequests() {
  const { attendanceRequests, leaveRequests, attendanceQueries, applyLeave } = useERP();
  const [filter, setFilter] = useState('all');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  // Leave form state (clean initial defaults)
  const [leaveType, setLeaveType] = useState('Medical');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [supportingFile, setSupportingFile] = useState(null);
  const [supportingDocName, setSupportingDocName] = useState('');

  const handleLeaveSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    applyLeave({
      leaveType,
      startDate,
      endDate,
      dateRangeLabel: `${startDate} to ${endDate}`,
      reason,
      file: supportingFile || null,
      supportingDoc: supportingFile || null
    });
    setLeaveModalOpen(false);
    setReason('');
    setSupportingFile(null);
    setSupportingDocName('');
  };

  // Combine requests with safe title fallback (Test 11 fix)
  const allRequests = [
    ...attendanceRequests,
    ...leaveRequests,
    ...attendanceQueries.map((q) => ({
      ...q,
      title: q.title || `Attendance Query: ${q.subjectName || q.subject?.name || q.subject || 'Dispute'}`,
      type: 'attendance_query'
    }))
  ];

  const isPendingOrActive = (status) => {
    const s = String(status || '').toLowerCase();
    return s.includes('pending') || s.includes('recommended') || s === 'processing_agent';
  };

  const isCompleted = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'completed' || s === 'approved' || s === 'approved_by_hod';
  };

  const filteredRequests = allRequests.filter((req) => {
    if (filter === 'active') return isPendingOrActive(req.status);
    if (filter === 'completed') return isCompleted(req.status);
    return true;
  });

  return (
    <div className="page-wrapper">
      <div className="flex flex-col gap-5">
        {/* Top Action Area */}
        <PageHeader
          title="Requests & Approvals"
          description="Real-time academic governance & autonomous clearance tracking"
          badge={<Badge variant="primary" size="sm">Autonomous Clearance</Badge>}
          actions={
            <Button
              variant="primary"
              onClick={() => setLeaveModalOpen(true)}
              leftIcon={<PlusCircle size={17} />}
            >
              Apply Leave / New Request
            </Button>
          }
        />

        {/* Transparent Workflow Journey Explainer Card */}
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Clearance Protocol
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Avg. 24h Autonomous Turnaround
            </span>
          </div>

          {/* 3-Step Journey Grid */}
          <div className="grid grid-cols-3 gap-2 text-center relative py-1">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <span className="text-xs font-semibold text-slate-900">
                Student Submits
              </span>
              <span className="text-[11px] text-slate-500">Digital e-Form</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <span className="text-xs font-semibold text-slate-900">
                Mentor / TG Review
              </span>
              <span className="text-[11px] text-slate-500">
                Approval workflow
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <span className="text-xs font-semibold text-slate-900">
                HOD Clearance & Sync
              </span>
              <span className="text-[11px] text-slate-500">Agent Auto-Update</span>
            </div>
          </div>
        </Card>

        {/* Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {[
            { id: 'all', label: `All (${allRequests.length})` },
            { id: 'active', label: `Active (${allRequests.filter((r) => isPendingOrActive(r.status)).length})` },
            { id: 'completed', label: `Completed (${allRequests.filter((r) => isCompleted(r.status)).length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all border-none cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Request Cards Container */}
        <div className="flex flex-col gap-3">
          {filteredRequests.length === 0 ? (
            <Card className="text-center py-10">
              <EmptyState
                icon={<Clock size={36} className="text-slate-400" />}
                title="No Records Found"
                description="No academic clearance or leave requests found for this filter."
                action={
                  <Button variant="primary" size="sm" onClick={() => setLeaveModalOpen(true)}>
                    Apply Now
                  </Button>
                }
              />
            </Card>
          ) : (
            filteredRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                showActions={false}
                role="student"
              />
            ))
          )}
        </div>

        {/* Quick Launchers (Action Tray matching Stitch) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Quick Request Launchers
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Frequently Used</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="sm:grid-cols-4">
            <button
              onClick={() => setLeaveModalOpen(true)}
              className="card card-interactive"
              style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--primary-fixed)',
                  color: 'var(--on-primary-fixed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Leave Application</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Medical & OD Duty</span>
              </div>
            </button>

            <button
              className="card card-interactive"
              style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--tertiary-fixed)',
                  color: 'var(--on-tertiary-fixed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Award size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Bonafide Certificate</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Passports & Education Loans</span>
              </div>
            </button>

            <button
              className="card card-interactive"
              style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--secondary-fixed)',
                  color: 'var(--on-secondary-fixed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileText size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Hall Ticket Clearance</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Exam Portal Authorization</span>
              </div>
            </button>

            <button
              className="card card-interactive"
              style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--surface-high)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <BookOpen size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Library NOC Slip</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dues & Book Return Slip</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {leaveModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-xl)',
                    backgroundColor: 'var(--primary-container)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    Apply for Student Leave
                  </h3>
                  <p className="modal-subtitle">
                    3-Tier Clearance with Autonomous Routing
                  </p>
                </div>
              </div>

              <button onClick={() => setLeaveModalOpen(false)} className="modal-close-btn" aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select
                  className="input-field"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="Medical">Medical Leave (Doctor verified)</option>
                  <option value="Duty">On-Duty / Academic Representation</option>
                  <option value="Personal">Personal / Family Emergency</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea
                  className="input-field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <div className="form-group">
                <DocumentUploader
                  label="Supporting Document (Certificate / Prescription)"
                  hint="Attach official hospital slip, medical certificate, or OD approval"
                  selectedFileName={supportingDocName}
                  onFileSelect={(fileInfo) => {
                    setSupportingFile(fileInfo.file);
                    setSupportingDocName(fileInfo.name);
                  }}
                  onFileRemove={() => {
                    setSupportingFile(null);
                    setSupportingDocName('');
                  }}
                />
              </div>

              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setLeaveModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Submit Application
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
