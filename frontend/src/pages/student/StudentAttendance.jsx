import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useERP } from '../../context/ERPContext';
import AttendanceProgress from '../../components/AttendanceProgress';
import { attendanceApi } from '../../api/attendanceApi';
import { requestApi } from '../../api/requestApi';
import { PageHeader, Card, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/common';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';

export default function StudentAttendance() {
  const { currentUser, addToast } = useERP();

  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [considerationModalOpen, setConsiderationModalOpen] = useState(false);
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Consideration Form
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [submittingConsideration, setSubmittingConsideration] = useState(false);

  // Query Form
  const [queryReason, setQueryReason] = useState('');
  const [submittingQuery, setSubmittingQuery] = useState(false);

  const fetchAttendanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceApi.getStudentStats();
      if (res) {
        setStats(res);
        setSessions(res.sessions || res.records || res.history || []);
      }
    } catch (err) {
      setError(err.message || 'Unable to load attendance records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const percentage = stats?.percentage !== undefined ? stats.percentage : (stats?.overallPercentage || 0);
  const totalClasses = stats?.totalClasses || stats?.total || 0;
  const attendedClasses = stats?.attendedClasses || stats?.attended || 0;

  const handleConsiderationSubmit = async (e) => {
    e.preventDefault();
    setSubmittingConsideration(true);
    try {
      await requestApi.submitAttendanceConsideration({
        title,
        startDate,
        endDate,
        dateRangeLabel: `${startDate} to ${endDate}`,
        reason
      });
      addToast('Consideration Submitted', 'Forwarded to your Mentor / TG for review.', 'success');
      setConsiderationModalOpen(false);
      fetchAttendanceData();
    } catch (err) {
      addToast('Submission Failed', err.message || 'Error lodging consideration.', 'error');
    } finally {
      setSubmittingConsideration(false);
    }
  };

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!queryReason.trim()) {
      addToast('Reason Required', 'Please provide a reason for the attendance dispute.', 'warning');
      return;
    }
    setSubmittingQuery(true);
    try {
      await requestApi.submitAttendanceQuery({
        subjectId: selectedSession?.subjectId || selectedSession?.subject?.id || null,
        subject: selectedSession?.subject?.name || selectedSession?.subject || 'Lecture',
        date: selectedSession?.date || new Date().toISOString().split('T')[0],
        period: selectedSession?.period ? `Period ${selectedSession.period}` : 'Class Period',
        reason: queryReason
      });
      addToast('Dispute Lodged', 'Attendance query forwarded to mentor & HOD for correction approval.', 'success');
      setQueryModalOpen(false);
      setQueryReason('');
      fetchAttendanceData();
    } catch (err) {
      addToast('Dispute Failed', err.message || 'Error submitting query.', 'error');
    } finally {
      setSubmittingQuery(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <PageHeader
          title="My Attendance & Academic Standing"
          description={`Relational attendance records for ${currentUser.name} (Section ${currentUser.section || 'A'})`}
          badge={<Badge variant="primary" size="sm">Live DB Synced</Badge>}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => setConsiderationModalOpen(true)}
                id="btn-attendance-request-od"
                leftIcon={<Sparkles size={16} />}
              >
                Request Consideration (OD)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchAttendanceData}
                disabled={loading}
                loading={loading}
                leftIcon={<RefreshCw size={13} />}
              >
                Refresh
              </Button>
            </div>
          }
        />

        {/* Loading / Error states */}
        {loading && (
          <div className="p-8 text-center text-slate-500 card flex flex-col items-center justify-center gap-2">
            <div className="spinner-border text-primary" role="status" style={{ width: '2rem', height: '2rem' }} />
            <span className="text-xs font-semibold">Loading Attendance Records from Database...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-danger-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="primary" size="sm" onClick={fetchAttendanceData}>
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Hero Attendance Gauge Card */}
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 m-0">
                      Aggregate Attendance Standing
                    </h3>
                    <span className="text-xs text-slate-500">
                      Total Sessions Recorded: {totalClasses} • Present: {attendedClasses}
                    </span>
                  </div>
                </div>

                <Badge variant={percentage >= 75 ? 'success' : 'danger'} size="sm" dot>
                  {percentage >= 75 ? 'Examination Eligible' : 'Shortage Alert'}
                </Badge>
              </div>

              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold tracking-tight tabular-nums ${percentage >= 75 ? 'text-success-600' : 'text-danger-600'}`}>
                  {percentage}%
                </span>
                <span className="text-xs text-slate-500">
                  (Statutory minimum threshold: 75%)
                </span>
              </div>

              <AttendanceProgress percentage={percentage} showDetails={false} />
            </Card>

            {/* Subject-Wise Attendance Breakdown */}
            {stats?.subjectWise && stats.subjectWise.length > 0 && (
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-3 m-0">
                  Subject-Wise Attendance Ledger
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {stats.subjectWise.map((sub, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 truncate" title={sub.subjectName}>
                          {sub.subjectName || sub.subjectCode}
                        </span>
                        <span className={`font-bold tabular-nums ${sub.percentage >= 75 ? 'text-success-600' : 'text-danger-600'}`}>
                          {sub.percentage}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Attended: {sub.present} / {sub.total} classes
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Recorded Sessions Ledger */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary-600" />
                  <h3 className="text-sm font-bold text-slate-900 m-0">Recorded Sessions History</h3>
                </div>
                <Badge variant="neutral" size="xs">{sessions.length} Recorded Entries</Badge>
              </div>

              {sessions.length === 0 ? (
                <EmptyState
                  title="No Attendance Records Found"
                  description="No class session history has been recorded for your account yet."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Period / Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((sess, idx) => {
                      const isAbsent = (sess.status || '').toLowerCase() === 'absent';
                      return (
                        <TableRow key={sess.id || idx}>
                          <TableCell className="text-slate-800 font-semibold">{sess.date}</TableCell>
                          <TableCell className="font-bold text-slate-900">
                            {sess.subject?.name || sess.subject || 'Lecture'}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {sess.period ? `Period ${sess.period}` : 'Regular Slot'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={!isAbsent ? 'success' : 'danger'} size="xs" dot>
                              {sess.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAbsent && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setSelectedSession(sess);
                                  setQueryModalOpen(true);
                                }}
                                className="text-danger-600 border-danger-200 hover:bg-danger-50"
                              >
                                Dispute Query
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Consideration (Duty) Modal */}
      {considerationModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}
          onClick={() => setConsiderationModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.75rem',
              width: '94%',
              maxWidth: '520px',
              maxHeight: 'calc(100vh - 2.5rem)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              margin: 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Request Attendance Consideration (OD)
                </h3>
              </div>
              <button onClick={() => setConsiderationModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConsiderationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Title / Event Name *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Technical Workshop / Hackathon Participation"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Detailed Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                  placeholder="Explain event participation and institutional representation..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConsiderationModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingConsideration}
                  style={{ flex: 2 }}
                >
                  Submit Consideration Request
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Query Dispute Modal */}
      {queryModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}
          onClick={() => setQueryModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.75rem',
              width: '94%',
              maxWidth: '460px',
              maxHeight: 'calc(100vh - 2.5rem)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              margin: 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={20} style={{ color: 'var(--danger)' }} />
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Dispute Absent Attendance
                </h3>
              </div>
              <button onClick={() => setQueryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
              Session on <strong>{selectedSession?.date}</strong> for <strong>{selectedSession?.subject?.name || selectedSession?.subject}</strong>.
            </p>

            <form onSubmit={handleQuerySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Dispute Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={queryReason}
                  onChange={(e) => setQueryReason(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Attended lecture and submitted lab practical. Roll call was missed..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setQueryModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingQuery}
                  style={{ flex: 2 }}
                >
                  Submit Dispute Query to HOD
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
