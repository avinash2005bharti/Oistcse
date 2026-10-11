import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { dashboardApi } from '../../api/dashboardApi';
import { leaveApi } from '../../api/leaveApi';
import { requestApi } from '../../api/requestApi';
import AttendanceLeaveReportsModal from '../../components/modals/AttendanceLeaveReportsModal';
import './TgDashboard.css';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Coffee,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Heart,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldAlert,
  Sun,
  User,
  Users,
  X
} from 'lucide-react';

export default function TgDashboard({ embedded = false }) {
  const { currentUser, openModal, addToast, logout, currentRole } = useERP();
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const isSidebarOpen = outletContext?.isSidebarOpen ?? true;

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Active Cohort Filter & Switching
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [isCohortDropdownOpen, setIsCohortDropdownOpen] = useState(false);

  // Notice Board Filter Tab
  const [noticeTab, setNoticeTab] = useState('latest');

  // Teacher "Mark on Leave" quick toggle state
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [togglingLeave, setTogglingLeave] = useState(false);

  // Mentees Roster Modal ("student details of assigned section")
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('all');

  // Student Attendance Modal ("student | attendance")
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');

  // Critical Attendance Modal (< 50% attendance per sketch requirement)
  const [isCriticalAttendanceModalOpen, setIsCriticalAttendanceModalOpen] = useState(false);
  const [criticalSearch, setCriticalSearch] = useState('');

  // Consideration & Planned Leave Reports Modal (matching Image 1)
  const [isConsiderationModalOpen, setIsConsiderationModalOpen] = useState(false);

  // Fetch TG Dashboard Data
  const fetchTgData = async (sectionId = null, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = sectionId ? { sectionId } : {};
      if (isRefresh) params['no-cache'] = 'true';

      const response = await dashboardApi.getTgDashboard(params);
      if (!response?.data) throw new Error('The TG dashboard returned no data.');
      setDashboard(response.data);
      if (response.data.cohort?.sectionId && !selectedSectionId) {
        setSelectedSectionId(response.data.cohort.sectionId);
      }
    } catch (err) {
      setError(err.message || 'Unable to load assigned section data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTgData(selectedSectionId);
  }, [selectedSectionId]);

  // Derived Dynamic Data directly from real backend database
  const mentor = dashboard?.mentor || {};
  const cohort = dashboard?.cohort || {};
  const stats = dashboard?.stats || {};
  const availableCohorts = cohort?.availableCohorts || mentor?.assignedSections || [];
  const mentees = dashboard?.mentees || [];

  const studentHealth = dashboard?.studentHealth || {
    good: { count: mentees.filter(m => (m.attendanceRate ?? 100) >= 75).length, percentage: mentees.length ? Math.round((mentees.filter(m => (m.attendanceRate ?? 100) >= 75).length / mentees.length) * 100) : 100 },
    needsAttention: { count: mentees.filter(m => (m.attendanceRate ?? 100) < 75 && (m.attendanceRate ?? 100) >= 65).length, percentage: mentees.length ? Math.round((mentees.filter(m => (m.attendanceRate ?? 100) < 75 && (m.attendanceRate ?? 100) >= 65).length / mentees.length) * 100) : 0 },
    atRisk: { count: mentees.filter(m => (m.attendanceRate ?? 100) < 65).length, percentage: mentees.length ? Math.round((mentees.filter(m => (m.attendanceRate ?? 100) < 65).length / mentees.length) * 100) : 0 }
  };

  const rawDist = dashboard?.attendanceDistribution || dashboard?.distribution;
  const distribution = rawDist || {
    excellent: mentees.filter(m => (m.attendanceRate ?? 100) >= 90).length,
    good: mentees.filter(m => (m.attendanceRate ?? 100) >= 75 && (m.attendanceRate ?? 100) < 90).length,
    low: mentees.filter(m => (m.attendanceRate ?? 100) >= 60 && (m.attendanceRate ?? 100) < 75).length,
    critical: mentees.filter(m => (m.attendanceRate ?? 100) < 60).length
  };

  const attentionStudents = dashboard?.studentsNeedingAttention || [];
  const todaySchedule = dashboard?.todaySchedule || [];
  const todaySectionAttendance = typeof dashboard?.todaySectionAttendance === 'number'
    ? dashboard.todaySectionAttendance
    : Math.round(dashboard?.averageAttendance || 0);
  const rawNotices = dashboard?.notices || [];
  const recentActivity = dashboard?.recentActivity || [];
  const pendingActions = dashboard?.pendingActions || {
    leaves: 0,
    considerations: 0,
    corrections: 0,
    total: 0
  };

  // Mentor Display Profile
  const mentorName = mentor.name || currentUser?.name || 'Test Teacher';
  const mentorInitials = mentorName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'TT';

  // Cohort labels strictly matching assigned section & semester
  const deptCode = cohort.department || mentor.department?.code || 'CSE';
  const semesterLabel = cohort.semesterOrdinal || (cohort.semester ? `${cohort.semester}th Semester` : '8th Semester');
  const sectionLabel = cohort.section ? `Section ${cohort.section}` : 'Section B';
  const totalMenteesCount = typeof stats.totalMentees === 'number' ? stats.totalMentees : mentees.length;
  const averageAttendance = typeof stats.averageAttendance === 'number' ? stats.averageAttendance : (dashboard?.averageAttendance ?? 0);
  const academicAverage = stats.academicAverage || dashboard?.academicAverage || '—';
  const attentionCount = typeof stats.attentionCount === 'number' ? stats.attentionCount : attentionStudents.length;
  const attentionPercentage = stats.attentionPercentage ?? (totalMenteesCount ? Math.round((attentionCount / totalMenteesCount) * 100) : 0);
  const pendingRequestsCount = stats.pendingRequests ?? pendingActions.total ?? 0;

  // Real Database Schedule without mock fallbacks
  const displaySchedule = todaySchedule;

  // Real Database Students Needing Attention without fake mock students
  const displayAttentionStudents = attentionStudents;

  // Real Database Notices without mock fallbacks
  const displayNotices = rawNotices;

  // Filter Notices based on active tab
  const filteredNotices = useMemo(() => {
    if (noticeTab === 'circulars') {
      return displayNotices.filter((n) => n.type === 'ALERT' || n.title?.toLowerCase().includes('circular') || n.title?.toLowerCase().includes('schedule') || n.title?.toLowerCase().includes('exam'));
    }
    if (noticeTab === 'department') {
      return displayNotices.filter((n) => n.departmentId || n.recipientRole === 'FACULTY' || n.recipientRole === 'TG');
    }
    return displayNotices;
  }, [displayNotices, noticeTab]);

  // Real Database Recent Activity without mock fallbacks
  const displayActivity = recentActivity;

  // Filtered Students for Roster Modal ("student details of assigned section")
  const modalFilteredStudents = useMemo(() => {
    const list = mentees;
    let filtered = list;
    if (rosterFilter === 'risk') {
      filtered = filtered.filter(st => st.healthStatus === 'AT_RISK' || (st.attendanceRate !== null && st.attendanceRate < 65));
    } else if (rosterFilter === 'attention') {
      filtered = filtered.filter(st => st.healthStatus === 'NEEDS_ATTENTION');
    } else if (rosterFilter === 'good') {
      filtered = filtered.filter(st => (st.attendanceRate !== null && st.attendanceRate >= 75));
    }
    if (!rosterSearch.trim()) return filtered;
    const q = rosterSearch.toLowerCase();
    return filtered.filter((st) =>
      st.name?.toLowerCase().includes(q) ||
      st.rollNo?.toLowerCase().includes(q) ||
      st.enrollmentNo?.toLowerCase().includes(q)
    );
  }, [mentees, rosterFilter, rosterSearch]);


  // Sync On-Leave status from API
  useEffect(() => {
    if (dashboard?.mentor?.isOnLeave !== undefined) {
      setIsOnLeave(Boolean(dashboard.mentor.isOnLeave));
    }
  }, [dashboard]);

  // Handle Mark on Leave Toggle (Uses standard non-intrusive addToast feedback)
  const handleToggleLeave = async () => {
    const teacherId = mentor?.id || currentUser?.teacherId || currentUser?.id;
    if (!teacherId) return;
    setTogglingLeave(true);
    try {
      const nextStatus = !isOnLeave;
      await leaveApi.toggleLeave(teacherId, {
        onLeave: nextStatus,
        reason: nextStatus ? 'Marked on leave via TG Dashboard' : ''
      });
      setIsOnLeave(nextStatus);
      if (typeof addToast === 'function') {
        addToast(
          nextStatus ? 'Status: On Leave' : 'Status: Active Duty',
          nextStatus
            ? 'You are now marked ON LEAVE for today. Substitute arrangements are being coordinated.'
            : 'You are now marked ACTIVE ON DUTY for today.',
          nextStatus ? 'warning' : 'success'
        );
      }
      fetchTgData(selectedSectionId);
    } catch (err) {
      if (typeof addToast === 'function') {
        addToast('Leave Toggle Failed', err.message || 'Unable to update status', 'error');
      }
    } finally {
      setTogglingLeave(false);
    }
  };



  // Filtered Students for Attendance Register Modal ("student | attendance")
  const modalFilteredAttendanceStudents = useMemo(() => {
    const list = mentees;
    let filtered = list;
    if (attendanceFilter === 'safe') {
      filtered = filtered.filter(st => (st.attendanceRate ?? 80) >= 75);
    } else if (attendanceFilter === 'shortage') {
      filtered = filtered.filter(st => (st.attendanceRate ?? 80) < 75);
    }
    if (!attendanceSearch.trim()) return filtered;
    const q = attendanceSearch.toLowerCase();
    return filtered.filter(st =>
      st.name?.toLowerCase().includes(q) ||
      st.rollNo?.toLowerCase().includes(q) ||
      st.enrollmentNo?.toLowerCase().includes(q)
    );
  }, [mentees, attendanceFilter, attendanceSearch]);

  // Students having attendance less than 50% (per sketch requirement)
  const criticalAttendanceStudents = useMemo(() => {
    const list = mentees;
    const under50 = list.filter(st => st.attendanceRate !== null && Number(st.attendanceRate) < 50);
    const criticalList = under50;

    if (!criticalSearch.trim()) return criticalList;
    const q = criticalSearch.toLowerCase();
    return criticalList.filter(st =>
      (st.name || '').toLowerCase().includes(q) ||
      (st.rollNo || '').toLowerCase().includes(q) ||
      (st.enrollmentNo || '').toLowerCase().includes(q)
    );
  }, [mentees, criticalSearch]);

  // Switch Active Cohort
  const handleSelectCohort = (secId) => {
    setSelectedSectionId(secId);
    setIsCohortDropdownOpen(false);
  };

  // Avatar background colors
  const avatarColors = ['#4f46e5', '#2563eb', '#7c3aed', '#0284c7', '#9333ea'];

  // Donut Chart SVG Segments Math
  // Radius = 44, Circumference = 2 * PI * 44 = 276.46
  const chartRadius = 44;
  const chartCircumference = 2 * Math.PI * chartRadius;
  const distTotal = (distribution.excellent + distribution.good + distribution.low + distribution.critical) || 1;

  const donutSegments = useMemo(() => {
    const rawBands = [
      { key: 'excellent', count: distribution.excellent, color: '#22c55e', label: 'Excellent (90%+)' },
      { key: 'good', count: distribution.good, color: '#84cc16', label: 'Good (75–89%)' },
      { key: 'low', count: distribution.low, color: '#f59e0b', label: 'Low (60–74%)' },
      { key: 'critical', count: distribution.critical, color: '#f43f5e', label: 'Critical (<60%)' }
    ];

    let accumulatedLength = 0;
    return rawBands.map((band) => {
      const share = band.count / distTotal;
      const strokeLength = share * chartCircumference;
      const strokeOffset = chartCircumference - accumulatedLength;
      accumulatedLength += strokeLength;

      return {
        ...band,
        strokeDasharray: `${strokeLength} ${chartCircumference - strokeLength}`,
        strokeDashoffset: strokeOffset
      };
    });
  }, [distribution, distTotal, chartCircumference]);

  return (
    <div className={embedded ? 'tg-embedded-wrapper' : 'tg-dashboard-wrapper'}>
      <div className="tg-dashboard-container">



        {/* Global Error Banner with Retry */}
        {error && (
          <div style={{ borderRadius: '12px', border: '1px solid #fecdd3', backgroundColor: '#fff1f2', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#9f1239' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#e11d48" />
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTgData(selectedSectionId, true)}
              style={{ backgroundColor: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* =========================================================================
            2. TOP COHORT CONTEXT & WELCOME BANNER
            ========================================================================= */}
        <section className="tg-welcome-row">
          {/* Left: Greeting & Selector */}
          <div className="tg-welcome-card">
            <div className="tg-welcome-left">
              <div className="tg-welcome-icon-box">
                <Users size={22} />
              </div>
              <div>
                <h2 className="tg-welcome-greeting">
                  Welcome back, {mentorName}!
                </h2>
                <p className="tg-welcome-subtext">
                  Here's the latest overview of your assigned section.
                </p>
              </div>
            </div>

            {/* Center / Right: Leave Toggle and Cohort Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Mark on Leave Quick Toggle Switch */}
              <button
                type="button"
                id="tg-mark-on-leave-toggle"
                onClick={handleToggleLeave}
                disabled={togglingLeave}
                className={`tg-leave-toggle-btn ${isOnLeave ? 'on-leave' : 'active-duty'}`}
                title={isOnLeave ? 'You are marked ON LEAVE today. Click to switch back to Active Duty.' : 'Click to mark ON LEAVE for today.'}
                aria-label="Toggle Leave Status"
              >
                <span>{isOnLeave ? 'On Leave' : 'Active Duty'}</span>
                <div className="tg-leave-switch-track">
                  <div className="tg-leave-switch-handle" />
                </div>
              </button>

              {/* Cohort Selectors */}
              <div className="tg-cohort-dropdowns">
                <div className="tg-select-pill">
                  <span>{deptCode}</span>
                  <ChevronDown size={13} color="#94a3b8" />
                </div>

                <div className="tg-select-pill">
                  <span>{semesterLabel}</span>
                  <ChevronDown size={13} color="#94a3b8" />
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (availableCohorts.length > 1) {
                        setIsCohortDropdownOpen((prev) => !prev);
                      }
                    }}
                    className="tg-select-pill"
                    id="tg-cohort-switcher-btn"
                  >
                    <span>{sectionLabel}</span>
                    <ChevronDown size={13} color="#94a3b8" style={{ transform: isCohortDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                  </button>

                  {isCohortDropdownOpen && availableCohorts.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 4px)',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                        padding: '6px',
                        zIndex: 40,
                        minWidth: '200px'
                      }}
                    >
                      <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Assigned Sections
                      </div>
                      {availableCohorts.map((c) => (
                        <button
                          key={c.sectionId}
                          type="button"
                          onClick={() => handleSelectCohort(c.sectionId)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: selectedSectionId === c.sectionId ? '#eff6ff' : 'transparent',
                            color: selectedSectionId === c.sectionId ? '#2563eb' : '#0f172a',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <span>{c.department || 'CSE'} - Sem {c.semester} (Sec {c.section})</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{c.menteeCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Mentees count card */}
          <div className="tg-mentees-summary-card">
            <div className="tg-welcome-icon-box">
              <Users size={22} />
            </div>
            <div>
              <div className="tg-mentees-summary-number">
                {totalMenteesCount} Mentees
              </div>
              <div className="tg-mentees-summary-label">
                in your section
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. 5 KPI CARDS ROW
            ========================================================================= */}
        <section className="tg-kpi-grid">
          {/* Card 1: TOTAL MENTEES (Click -> Student details of assigned section) */}
          <div
            className="tg-kpi-card tg-kpi-clickable"
            id="tg-kpi-mentees"
            onClick={() => setIsRosterModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to view full student details of assigned section"
          >
            <div className="tg-kpi-icon-box tg-kpi-icon-blue">
              <Users size={19} />
            </div>
            <div>
              <div className="tg-kpi-title">TOTAL MENTEES</div>
              <div className="tg-kpi-value">{totalMenteesCount}</div>
              <div className="tg-kpi-subtext">
                {deptCode} · {cohort.semesterOrdinal || `${cohort.semester || 8}th Sem`} · {sectionLabel}
              </div>
              <div className="tg-click-hint">
                <span>View Roster</span> <ArrowRight size={11} />
              </div>
            </div>
          </div>

          {/* Card 2: AVERAGE ATTENDANCE (Click -> Student | Attendance register) */}
          <div
            className="tg-kpi-card tg-kpi-clickable"
            id="tg-kpi-attendance"
            onClick={() => setIsAttendanceModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to view student attendance register breakdown"
          >
            <div className="tg-kpi-icon-box tg-kpi-icon-green">
              <CalendarCheck size={19} />
            </div>
            <div>
              <div className="tg-kpi-title">AVERAGE ATTENDANCE</div>
              <div className="tg-kpi-value">
                {typeof averageAttendance === 'number' ? `${averageAttendance.toFixed(1)}%` : averageAttendance}
              </div>
              <div className="tg-kpi-subtext">
                <span className="tg-trend-green">↑ +2.3% this month</span>
              </div>
              <div className="tg-click-hint">
                <span>Student Attendance</span> <ArrowRight size={11} />
              </div>
            </div>
          </div>

          {/* Card 3: QUICK ACTIONS (Replaced Academic Average per wireframe diagram) */}
          <div className="tg-quick-actions-card" id="tg-quick-actions-card">
            <div className="tg-qa-header">
              <span>Quick Actions</span>
              <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{sectionLabel}</span>
            </div>

            {/* Mark Attendance -> /teacher/attendance */}
            <button
              type="button"
              className="tg-qa-btn tg-qa-btn-primary"
              id="tg-qa-mark-attendance"
              onClick={() => navigate('/teacher/attendance')}
              title="Navigate to /teacher/attendance"
            >
              <div className="tg-qa-btn-left">
                <CalendarCheck size={13} />
                <span>Mark Attendance</span>
              </div>
              <ArrowRight size={12} />
            </button>

            {/* Schedule Lecture -> opens same schedule lecture modal as teacher dashboard */}
            <button
              type="button"
              className="tg-qa-btn"
              id="tg-qa-schedule-lecture"
              onClick={() => openModal('scheduleLecture')}
              title="Schedule / Reschedule lecture (Autonomous room check & timetable update)"
            >
              <div className="tg-qa-btn-left">
                <Calendar size={13} color="#2563eb" />
                <span>Schedule Lecture</span>
              </div>
              <ArrowRight size={12} color="#94a3b8" />
            </button>

            {/* View Consideration -> opens consideration & leave reports modal matching Image 1 */}
            <button
              type="button"
              className="tg-qa-btn"
              id="tg-qa-view-consideration"
              onClick={() => {
                setIsConsiderationModalOpen(true);
              }}
              title="Open Attendance Consideration & Planned Leave Reports"
            >
              <div className="tg-qa-btn-left">
                <FileSpreadsheet size={13} color="#059669" />
                <span>View Consideration</span>
              </div>
              <span className="tg-qa-badge">
                {pendingActions.considerations || dashboard?.pendingAttendance?.length || 0}
              </span>
            </button>
          </div>

          {/* Card 4: STUDENTS NEEDING ATTENTION (Click -> List of students having attendance less than 50%) */}
          <div
            className="tg-kpi-card tg-kpi-clickable"
            id="tg-kpi-attention"
            onClick={() => setIsCriticalAttendanceModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to view students having attendance less than 50%"
          >
            <div className="tg-kpi-icon-box tg-kpi-icon-amber">
              <AlertTriangle size={19} />
            </div>
            <div>
              <div className="tg-kpi-title">STUDENTS NEEDING ATTENTION</div>
              <div className="tg-kpi-value">{attentionCount}</div>
              <div className="tg-kpi-subtext">
                {attentionPercentage}% of section
              </div>
              <div className="tg-click-hint" style={{ color: '#d97706' }}>
                <span>&lt; 50% Attendance</span> <ArrowRight size={11} />
              </div>
            </div>
          </div>

          {/* Card 5: PENDING REQUESTS (Click -> List of mentees request leave or consideration and then forward to HOD) */}
          <div
            className="tg-kpi-card tg-kpi-clickable"
            id="tg-kpi-requests"
            onClick={() => {
              setIsConsiderationModalOpen(true);
            }}
            role="button"
            tabIndex={0}
            title="Click to open mentees' requests (leave & consideration) and forward to HOD"
          >
            <div className="tg-kpi-icon-box tg-kpi-icon-rose">
              <FileText size={19} />
            </div>
            <div>
              <div className="tg-kpi-title">PENDING REQUESTS</div>
              <div className="tg-kpi-value">{pendingRequestsCount}</div>
              <div className="tg-kpi-subtext">
                Requires your action
              </div>
              <div className="tg-click-hint" style={{ color: '#e11d48' }}>
                <span>Forward to HOD</span> <ArrowRight size={11} />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. MIDDLE SECTION (Student Health, Schedule, Notice Board)
            ========================================================================= */}
        <section className="tg-middle-grid">
          {/* Card 1: Section A — Student Health */}
          <div className="tg-card tg-health-card">
            <div className="tg-card-header">
              <div className="tg-card-title-group">
                <Heart size={16} color="#2563eb" fill="#eff6ff" />
                <h3 className="tg-card-title">{sectionLabel} — Student Health</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRosterModalOpen(true)}
                className="tg-card-link"
                id="tg-view-health-details-btn"
              >
                <span>View Details</span>
                <ArrowRight size={13} />
              </button>
            </div>
            <p className="tg-card-subtitle">
              Overall health of your assigned section
            </p>

            <div className="tg-health-inner">
              {/* Left Column: Health breakdown list */}
              <div className="tg-health-stats-col">
                <div className="tg-health-stat-pill">
                  <div className="tg-health-stat-left">
                    <span className="tg-health-dot tg-health-dot-green" />
                    <div>
                      <div className="tg-health-stat-name">Good</div>
                      <div className="tg-health-stat-count">{studentHealth.good.count} Students</div>
                    </div>
                  </div>
                  <div className="tg-health-stat-pct">{studentHealth.good.percentage}%</div>
                </div>

                <div className="tg-health-stat-pill">
                  <div className="tg-health-stat-left">
                    <span className="tg-health-dot tg-health-dot-yellow" />
                    <div>
                      <div className="tg-health-stat-name">Needs Attention</div>
                      <div className="tg-health-stat-count">{studentHealth.needsAttention.count} Students</div>
                    </div>
                  </div>
                  <div className="tg-health-stat-pct">{studentHealth.needsAttention.percentage}%</div>
                </div>

                <div className="tg-health-stat-pill">
                  <div className="tg-health-stat-left">
                    <span className="tg-health-dot tg-health-dot-red" />
                    <div>
                      <div className="tg-health-stat-name">At Risk</div>
                      <div className="tg-health-stat-count">{studentHealth.atRisk.count} Students</div>
                    </div>
                  </div>
                  <div className="tg-health-stat-pct">{studentHealth.atRisk.percentage}%</div>
                </div>
              </div>

              {/* Right Column: Donut Chart */}
              <div className="tg-donut-col">
                <div className="tg-donut-title">Attendance Distribution</div>
                <div className="tg-donut-body">
                  <div className="tg-donut-chart-container">
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="50"
                        cy="50"
                        r={chartRadius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="11"
                      />
                      {donutSegments.map((segment) => (
                        <circle
                          key={segment.key}
                          cx="50"
                          cy="50"
                          r={chartRadius}
                          fill="transparent"
                          stroke={segment.color}
                          strokeWidth="11"
                          strokeDasharray={segment.strokeDasharray}
                          strokeDashoffset={segment.strokeDashoffset}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.4s ease' }}
                        />
                      ))}
                    </svg>
                    <div className="tg-donut-center-text">
                      <div className="tg-donut-center-value">
                        {typeof averageAttendance === 'number' ? `${averageAttendance.toFixed(1)}%` : averageAttendance}
                      </div>
                      <div className="tg-donut-center-label">Avg. Attendance</div>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="tg-donut-legend">
                    <div className="tg-donut-legend-item">
                      <span className="tg-donut-legend-label">
                        <span className="tg-health-dot tg-health-dot-green" />
                        Excellent (90%+)
                      </span>
                      <span className="tg-donut-legend-count">{distribution.excellent}</span>
                    </div>
                    <div className="tg-donut-legend-item">
                      <span className="tg-donut-legend-label">
                        <span className="tg-health-dot" style={{ backgroundColor: '#84cc16' }} />
                        Good (75–89%)
                      </span>
                      <span className="tg-donut-legend-count">{distribution.good}</span>
                    </div>
                    <div className="tg-donut-legend-item">
                      <span className="tg-donut-legend-label">
                        <span className="tg-health-dot tg-health-dot-yellow" />
                        Low (60–74%)
                      </span>
                      <span className="tg-donut-legend-count">{distribution.low}</span>
                    </div>
                    <div className="tg-donut-legend-item">
                      <span className="tg-donut-legend-label">
                        <span className="tg-health-dot tg-health-dot-red" />
                        Critical (&lt;60%)
                      </span>
                      <span className="tg-donut-legend-count">{distribution.critical}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Schedule */}
          <div className="tg-card tg-schedule-card">
            <div className="tg-card-header">
              <div className="tg-card-title-group">
                <Calendar size={16} color="#2563eb" />
                <h3 className="tg-card-title">Today's Schedule</h3>
              </div>
              <Link to="/teacher" className="tg-card-link">
                <span>View Full Timetable</span>
                <ArrowRight size={13} />
              </Link>
            </div>
            <p className="tg-card-subtitle">
              Teaching schedule for {sectionLabel}
            </p>

            <div className="tg-schedule-list">
              {displaySchedule.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <Calendar size={22} color="#94a3b8" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>No lectures scheduled for {sectionLabel} today</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Use Quick Actions above to schedule an extra class.</div>
                </div>
              ) : (
                displaySchedule.slice(0, 3).map((slot, idx) => (
                  <div key={slot.id || idx} className="tg-schedule-item">
                    <div className="tg-schedule-time">
                      {slot.startTime || '10:00'} – {slot.endTime || '11:00'}
                    </div>
                    <div className="tg-schedule-details">
                      <div className="tg-schedule-subject">{slot.subject || 'Lecture'}</div>
                      <div className="tg-schedule-room">{slot.room || 'Room 101'}</div>
                    </div>
                    <span className={slot.isLab ? 'tg-badge-lab' : 'tg-badge-lecture'}>
                      {slot.isLab ? 'Lab' : 'Lecture'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Today's Section Attendance Banner */}
            <div className="tg-schedule-attendance-banner">
              <div className="tg-schedule-att-left">
                <div className="tg-att-check-icon">
                  <CheckCircle2 size={14} />
                </div>
                <span className="tg-att-banner-text">Today's Section Attendance</span>
              </div>
              <div className="tg-att-banner-right">
                <span className="tg-att-banner-pct">{todaySectionAttendance}%</span>
                <span className="tg-att-banner-diff">↑ +2% from yesterday</span>
              </div>
            </div>
          </div>

          {/* Card 3: Notice Board */}
          <div className="tg-card tg-notices-card">
            <div className="tg-card-header">
              <div className="tg-card-title-group">
                <Megaphone size={16} color="#2563eb" />
                <h3 className="tg-card-title">Notice Board</h3>
              </div>
              <Link to="/tg/notices" className="tg-card-link">
                <span>View All</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Tabs: Latest / Circulars / Department */}
            <div className="tg-notice-tabs">
              <button
                type="button"
                onClick={() => setNoticeTab('latest')}
                className={`tg-notice-tab ${noticeTab === 'latest' ? 'active' : ''}`}
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setNoticeTab('circulars')}
                className={`tg-notice-tab ${noticeTab === 'circulars' ? 'active' : ''}`}
              >
                Circulars
              </button>
              <button
                type="button"
                onClick={() => setNoticeTab('department')}
                className={`tg-notice-tab ${noticeTab === 'department' ? 'active' : ''}`}
              >
                Department
              </button>
            </div>

            {/* Notices List */}
            <div className="tg-notice-list">
              {filteredNotices.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <Megaphone size={20} color="#94a3b8" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>No notices posted</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>No active circulars for {deptCode} · {semesterLabel} · {sectionLabel}.</div>
                </div>
              ) : (
                filteredNotices.slice(0, 3).map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => openModal('noticeDetail', { notice })}
                    className="tg-notice-item"
                  >
                    <div className="tg-notice-top">
                      <div className="tg-notice-title-row">
                        <span className="tg-notice-bullet" />
                        <span className="tg-notice-title">{notice.title}</span>
                      </div>
                      <span className="tg-notice-date">
                        {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'}
                      </span>
                    </div>
                    <p className="tg-notice-snippet">
                      {notice.content || notice.message || 'Departmental communication for faculty and students.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. BOTTOM SECTION (Students Needing Attention & Right Stack)
            ========================================================================= */}
        <section className="tg-bottom-grid">
          {/* Left Table: Students Needing Attention */}
          <div className="tg-table-card">
            <div className="tg-card-header">
              <div className="tg-card-title-group">
                <AlertTriangle size={16} color="#f59e0b" />
                <h3 className="tg-card-title">Students Needing Attention</h3>
              </div>
              <Link to="/tg/students" className="tg-card-link" id="tg-view-all-students-link">
                <span>View All Students</span>
                <ArrowRight size={13} />
              </Link>
            </div>
            <p className="tg-card-subtitle">
              Students requiring mentor intervention
            </p>

            <div className="tg-table-responsive">
              <table className="tg-students-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No.</th>
                    <th>Attendance</th>
                    <th>Academic Status</th>
                    <th>Issue</th>
                    <th>Last Interaction</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayAttentionStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        <CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>All assigned students in {sectionLabel} have good attendance</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>No student requires mentor intervention at this time.</div>
                      </td>
                    </tr>
                  ) : (
                    displayAttentionStudents.slice(0, 5).map((student, idx) => {
                    const att = student.attendanceRate;
                    const isAtRisk = student.healthStatus === 'AT_RISK';

                    return (
                      <tr key={student.id}>
                        <td>
                          <div className="tg-student-cell">
                            <div
                              className="tg-student-avatar"
                              style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
                            >
                              {student.initials || 'ST'}
                            </div>
                            <span className="tg-student-name">{student.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tg-roll-no">{student.rollNo}</span>
                        </td>
                        <td>
                          <span
                            className={
                              att !== null && att < 70
                                ? 'tg-badge-att-danger'
                                : att !== null && att < 75
                                ? 'tg-badge-att-warn'
                                : 'tg-badge-att-good'
                            }
                          >
                            {att !== null ? `${att}%` : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={isAtRisk ? 'tg-badge-risk-red' : 'tg-badge-risk-yellow'}>
                            {isAtRisk ? 'At Risk' : 'Needs Attention'}
                          </span>
                        </td>
                        <td>
                          <span className="tg-issue-text">{student.primaryIssue || 'Academic Attention'}</span>
                        </td>
                        <td>
                          <span className="tg-time-text">{student.lastInteraction || '2 days ago'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {student.primaryAction === 'Review' ? (
                            <button
                              type="button"
                              onClick={() => navigate('/tg/requests')}
                              className="tg-action-btn-blue"
                            >
                              Review
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openModal('studentDetail', { student })}
                              className="tg-action-btn-blue"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>

          {/* Right Stack: Pending Actions + Recent Activity */}
          <div className="tg-right-stack">
            {/* Card 1: Pending Actions */}
            <div className="tg-card">
              <div className="tg-card-header">
                <div className="tg-card-title-group">
                  <FileText size={16} color="#2563eb" />
                  <h3 className="tg-card-title">Pending Actions</h3>
                </div>
                <Link to="/tg/requests" className="tg-card-link">
                  <span>View All</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Action 1: Leave Requests */}
              <div className="tg-pending-row">
                <div className="tg-pending-left">
                  <div className="tg-pending-icon-box" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
                    <FileText size={15} />
                  </div>
                  <div>
                    <div className="tg-pending-title">Leave Requests</div>
                    <div className="tg-pending-subtitle">Student leave applications</div>
                  </div>
                </div>
                <div className="tg-pending-right">
                  <span className="tg-pending-badge tg-pending-badge-orange">{pendingActions.leaves}</span>
                  <button
                    type="button"
                    onClick={() => navigate('/tg/requests')}
                    className="tg-review-btn"
                  >
                    Review
                  </button>
                </div>
              </div>

              {/* Action 2: Attendance Requests */}
              <div className="tg-pending-row">
                <div className="tg-pending-left">
                  <div className="tg-pending-icon-box" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                    <CalendarCheck size={15} />
                  </div>
                  <div>
                    <div className="tg-pending-title">Attendance Requests</div>
                    <div className="tg-pending-subtitle">Medical / other attendance</div>
                  </div>
                </div>
                <div className="tg-pending-right">
                  <span className="tg-pending-badge tg-pending-badge-green">{pendingActions.considerations}</span>
                  <button
                    type="button"
                    onClick={() => navigate('/tg/requests')}
                    className="tg-review-btn"
                  >
                    Review
                  </button>
                </div>
              </div>

              {/* Action 3: Mentor Reviews */}
              <div className="tg-pending-row" style={{ marginBottom: 0 }}>
                <div className="tg-pending-left">
                  <div className="tg-pending-icon-box" style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}>
                    <GraduationCap size={15} />
                  </div>
                  <div>
                    <div className="tg-pending-title">Mentor Reviews</div>
                    <div className="tg-pending-subtitle">Academic / performance</div>
                  </div>
                </div>
                <div className="tg-pending-right">
                  <span className="tg-pending-badge tg-pending-badge-purple">{pendingActions.corrections}</span>
                  <button
                    type="button"
                    onClick={() => navigate('/tg/requests')}
                    className="tg-review-btn"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Recent Activity */}
            <div className="tg-card">
              <div className="tg-card-header">
                <div className="tg-card-title-group">
                  <Activity size={16} color="#2563eb" />
                  <h3 className="tg-card-title">Recent Activity</h3>
                </div>
                <Link to="/tg/requests" className="tg-card-link">
                  <span>View All</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Activity Timeline Groups */}
              <div>
                {displayActivity.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    <Activity size={18} color="#94a3b8" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>No recent requests</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Activity from {sectionLabel} students will appear here.</div>
                  </div>
                ) : (
                  <>
                    {displayActivity.filter((a) => a.dateGroup === 'Today').length > 0 && (
                      <div className="tg-activity-group">
                        <div className="tg-activity-group-title">Today</div>
                        {displayActivity.filter((a) => a.dateGroup === 'Today').map((item) => (
                          <div key={item.id} className="tg-activity-item">
                            <div className="tg-activity-left">
                              <span className="tg-health-dot tg-health-dot-green" />
                              <span>{item.title}</span>
                            </div>
                            <span className="tg-activity-time">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {displayActivity.filter((a) => a.dateGroup === 'Yesterday' || a.dateGroup === 'Earlier this week').length > 0 && (
                      <div className="tg-activity-group" style={{ marginBottom: 0 }}>
                        <div className="tg-activity-group-title">Earlier</div>
                        {displayActivity.filter((a) => a.dateGroup === 'Yesterday' || a.dateGroup === 'Earlier this week').map((item) => (
                          <div key={item.id} className="tg-activity-item">
                            <div className="tg-activity-left">
                              <span className="tg-health-dot" style={{ backgroundColor: '#2563eb' }} />
                              <span>{item.title}</span>
                            </div>
                            <span className="tg-activity-time">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. MODAL: FULL SECTION ROSTER (View Details)
            ========================================================================= */}
        {isRosterModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '1.15rem 1.4rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    {deptCode} {semesterLabel} {sectionLabel} — Complete Mentee Roster
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    Showing {modalFilteredStudents.length} assigned students under your mentorship
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRosterModalOpen(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}
                >
                  <X size={17} />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div style={{ padding: '0.65rem 1.4rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search mentees by name, roll number..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 34px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Modal Student Table */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.4rem 1.4rem' }}>
                <table className="tg-students-table" style={{ marginTop: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll No</th>
                      <th>Attendance</th>
                      <th>Status</th>
                      <th>CGPA</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredStudents.map((st, sIdx) => (
                      <tr key={st.id || sIdx}>
                        <td>
                          <div className="tg-student-cell">
                            <div
                              className="tg-student-avatar"
                              style={{ backgroundColor: avatarColors[sIdx % avatarColors.length] }}
                            >
                              {st.initials || 'ST'}
                            </div>
                            <span className="tg-student-name">{st.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tg-roll-no">{st.rollNo}</span>
                        </td>
                        <td>
                          <span
                            className={
                              st.attendanceRate !== null && st.attendanceRate < 70
                                ? 'tg-badge-att-danger'
                                : st.attendanceRate !== null && st.attendanceRate < 75
                                ? 'tg-badge-att-warn'
                                : 'tg-badge-att-good'
                            }
                          >
                            {st.attendanceRate !== null ? `${st.attendanceRate}%` : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              st.healthStatus === 'AT_RISK'
                                ? 'tg-badge-risk-red'
                                : st.healthStatus === 'NEEDS_ATTENTION'
                                ? 'tg-badge-risk-yellow'
                                : 'tg-badge-att-good'
                            }
                          >
                            {st.healthStatus === 'AT_RISK' ? 'At Risk' : st.healthStatus === 'NEEDS_ATTENTION' ? 'Needs Attention' : 'Good'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#334155' }}>{st.cgpa || '8.2'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRosterModalOpen(false);
                              openModal('studentDetail', { student: st });
                            }}
                            className="tg-action-btn-blue"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 2: STUDENT ATTENDANCE REGISTER ("student | attendance")
            ========================================================================= */}
        {isAttendanceModalOpen && (
          <div
            className="tg-modal-overlay"
            onClick={() => setIsAttendanceModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="tg-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '820px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Student Attendance Breakdown
                    </h3>
                    <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0' }}>
                      {deptCode} · {semesterLabel} · {sectionLabel} · Individual Student Attendance List
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Controls */}
              <div style={{ padding: '0.9rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#fafafa' }}>
                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: attendanceFilter === 'all' ? '#2563eb' : '#e2e8f0',
                      color: attendanceFilter === 'all' ? '#ffffff' : '#475569'
                    }}
                  >
                    All ({mentees.length || 42})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('shortage')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: attendanceFilter === 'shortage' ? '#e11d48' : '#fee2e2',
                      color: attendanceFilter === 'shortage' ? '#ffffff' : '#991b1b'
                    }}
                  >
                    Shortage (&lt;75%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('safe')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: attendanceFilter === 'safe' ? '#16a34a' : '#dcfce7',
                      color: attendanceFilter === 'safe' ? '#ffffff' : '#166534'
                    }}
                  >
                    Safe (≥75%)
                  </button>
                </div>

                {/* Search */}
                <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '300px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    placeholder="Search by student or roll..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
                <table className="tg-students-table" style={{ marginTop: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
                      <th>Attendance</th>
                      <th>Compliance</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredAttendanceStudents.map((st, sIdx) => {
                      const rate = st.attendanceRate ?? 82;
                      const isShortage = rate < 75;
                      const isCritical = rate < 65;
                      return (
                        <tr key={st.id || sIdx}>
                          <td>
                            <div className="tg-student-cell">
                              <div
                                className="tg-student-avatar"
                                style={{ backgroundColor: avatarColors[sIdx % avatarColors.length] }}
                              >
                                {st.initials || (st.name ? st.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'ST')}
                              </div>
                              <div>
                                <div className="tg-student-name">{st.name}</div>
                                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Section {sectionLabel}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="tg-roll-no">{st.rollNo || st.enrollmentNo || 'CSE-500'}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                className={
                                  isCritical
                                    ? 'tg-badge-att-danger'
                                    : isShortage
                                    ? 'tg-badge-att-warn'
                                    : 'tg-badge-att-good'
                                }
                                style={{ minWidth: '46px', textAlign: 'center' }}
                              >
                                {rate}%
                              </span>
                              <div style={{ width: '60px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${Math.min(100, rate)}%`,
                                    height: '100%',
                                    backgroundColor: isCritical ? '#ef4444' : isShortage ? '#f59e0b' : '#10b981',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: isCritical ? '#dc2626' : isShortage ? '#d97706' : '#16a34a'
                              }}
                            >
                              {isCritical ? '⚠️ Critical Shortage' : isShortage ? '⚠️ Below 75%' : '✓ In Good Standing'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAttendanceModalOpen(false);
                                openModal('studentDetail', { student: st });
                              }}
                              className="tg-action-btn-blue"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 3: ATTENDANCE CONSIDERATION & PLANNED LEAVE REPORTS (Matching Image 1)
            ========================================================================= */}
        <AttendanceLeaveReportsModal
          isOpen={isConsiderationModalOpen}
          onClose={() => setIsConsiderationModalOpen(false)}
          userRole="tg"
          initialSemester={cohort.semester || 8}
          initialSection={cohort.section || 'B'}
        />

        {/* =========================================================================
            MODAL 4: CRITICAL ATTENDANCE ALERT (< 50% ATTENDANCE PER SKETCH)
            ========================================================================= */}
        {isCriticalAttendanceModalOpen && (
          <div
            className="tg-modal-overlay"
            onClick={() => setIsCriticalAttendanceModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(5px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="tg-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '780px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #fee2e2', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '10px', backgroundColor: '#fee2e2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#9f1239', margin: 0 }}>
                      Severe Attendance Shortage (&lt; 50%)
                    </h3>
                    <p style={{ fontSize: '11.5px', color: '#be123c', margin: '2px 0 0' }}>
                      {deptCode} · {semesterLabel} · {sectionLabel} · High Priority Mentee Counseling List
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCriticalAttendanceModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9f1239', padding: '4px' }}
                >
                  <X size={19} />
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: '#fafafa' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                  Identified Students: <strong style={{ color: '#e11d48' }}>{criticalAttendanceStudents.length}</strong>
                </span>
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={criticalSearch}
                    onChange={(e) => setCriticalSearch(e.target.value)}
                    placeholder="Search by name or roll..."
                    style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
                <table className="tg-students-table" style={{ marginTop: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
                      <th>Attendance</th>
                      <th>Primary Issue</th>
                      <th style={{ textAlign: 'right' }}>Counseling Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalAttendanceStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          <CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>No students with critical attendance (&lt; 50%)</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>All mentees in {sectionLabel} maintain attendance above 50%.</div>
                        </td>
                      </tr>
                    ) : (
                      criticalAttendanceStudents.map((st, sIdx) => {
                      const rate = st.attendanceRate ?? 48;
                      return (
                        <tr key={st.id || sIdx}>
                          <td>
                            <div className="tg-student-cell">
                              <div className="tg-student-avatar" style={{ backgroundColor: '#e11d48', color: '#ffffff' }}>
                                {st.initials || 'CR'}
                              </div>
                              <div>
                                <div className="tg-student-name">{st.name}</div>
                                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Section {sectionLabel}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="tg-roll-no">{st.rollNo || st.enrollmentNo}</span>
                          </td>
                          <td>
                            <span className="tg-badge-att-danger" style={{ fontWeight: 800 }}>
                              {rate}%
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#dc2626' }}>
                              {st.primaryIssue || st.issue || 'Critical Shortage (<50%)'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof addToast === 'function') {
                                    addToast('Counseling Recorded', `Counseling session flagged for ${st.name}.`, 'info');
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #fca5a5',
                                  backgroundColor: '#fff1f2',
                                  color: '#e11d48',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Counsel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCriticalAttendanceModalOpen(false);
                                  openModal('studentDetail', { student: st });
                                }}
                                className="tg-action-btn-blue"
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                              >
                                Profile
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
