import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { dashboardApi } from '../../api/dashboardApi';
import { Users, Search, AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck, Mail } from 'lucide-react';

export default function TgMyStudents() {
  const { currentUser, openModal } = useERP();
  const [students, setStudents] = useState([]);
  const [assignedSection, setAssignedSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    dashboardApi.getTgDashboard()
      .then((res) => {
        if (!isMounted) return;
        setStudents(res?.data?.mentees || []);
        setAssignedSection(res?.data?.mentor?.assignedSection || 'Section unassigned');
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Unable to load your assigned mentees.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredStudents = students.filter((st) => {
    const studentName = (st.name || '').toLowerCase();
    const roll = (st.rollNo || st.enrollment_no || '').toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = studentName.includes(q) || roll.includes(q) || (st.academicStatus || '').toLowerCase().includes(q) || (st.issue || '').toLowerCase().includes(q);

    const att = st.attendanceRate !== undefined && st.attendanceRate !== null ? st.attendanceRate : (st.attendance !== undefined ? st.attendance : 80);
    const health = st.healthStatus || (att < 60 ? 'AT_RISK' : att < 75 ? 'NEEDS_ATTENTION' : 'GOOD');

    if (filter === 'at-risk') return matchesSearch && health === 'AT_RISK';
    if (filter === 'needs-attention') return matchesSearch && health === 'NEEDS_ATTENTION';
    if (filter === 'good') return matchesSearch && health === 'GOOD';
    return matchesSearch;
  });

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              My Mentees ({assignedSection || currentUser?.assignedSection || 'Section unassigned'})
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Teacher Guardian supervision • {students.length} assigned mentees in this section
            </p>
          </div>

          <span className="badge badge-indigo">
            <Users size={14} />
            <span>TG: {currentUser?.name || 'Mentor'}</span>
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by student name, roll number, issue, or academic standing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ border: 'none', boxShadow: 'none', height: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Students' },
              { id: 'at-risk', label: 'At Risk (<60%)' },
              { id: 'needs-attention', label: 'Needs Attention (60-74%)' },
              { id: 'good', label: 'Good Standing (≥75%)' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="btn btn-sm"
                style={{
                  backgroundColor: filter === f.id ? 'var(--primary)' : '#FFFFFF',
                  color: filter === f.id ? '#FFFFFF' : 'var(--text-secondary)',
                  border: filter === f.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: filter === f.id ? 700 : 500
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="card text-sm text-danger-700">{error}</div>}

        {loading && <div className="card text-center text-slate-500">Loading your assigned mentees…</div>}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredStudents.length === 0 ? (
            <div className="card text-center" style={{ padding: '2.5rem', color: 'var(--text-secondary)' }}>
              <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No students found</h3>
              <p style={{ fontSize: '13px', margin: '0.25rem 0 0' }}>No mentees assigned in database.</p>
            </div>
          ) : (
            filteredStudents.map((st) => {
              const att = st.attendance !== undefined ? st.attendance : 80;
              const isAtRisk = att < 75;
              const roll = st.enrollment_no || st.rollNo || 'N/A';

              return (
                <div
                  key={st.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.25rem',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', flex: 1 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: isAtRisk ? 'var(--error-container)' : 'var(--secondary-container)',
                        color: isAtRisk ? 'var(--on-error-container)' : 'var(--on-secondary-container)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                        flexShrink: 0
                      }}
                    >
                      {(st.name || 'S').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {st.name}
                        </h4>
                        {st.autoUpdated && (
                          <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                            Auto-Adjusted by Agent
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Enrollment: {roll} • Semester: {st.semester || '—'} • Section: {typeof st.section === 'object' && st.section !== null ? (st.section.name || 'Unassigned') : (st.section || 'Unassigned')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Attendance</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: '18px',
                          fontWeight: 800,
                          color: isAtRisk ? 'var(--error)' : 'var(--secondary)'
                        }}
                      >
                        {att}%
                      </span>
                    </div>

                    <span className={`badge ${isAtRisk ? 'badge-rose' : 'badge-emerald'}`}>
                      {isAtRisk ? 'Shortage Alert' : 'Eligible'}
                    </span>

                    <button
                      onClick={() => openModal('studentDetail', { student: st })}
                      className="btn btn-sm btn-primary text-xs py-1.5 px-3"
                      id={`btn-inspect-${roll}`}
                    >
                      <span>Inspect Profile</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>
        )}
      </div>
    </div>
  );
}
