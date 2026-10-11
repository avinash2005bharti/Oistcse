import React, { useEffect, useState, useCallback } from 'react';
import { useERP } from '../../context/ERPContext';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboardApi';
import { leaveApi, studentApi } from '../../api';
import { requestApi } from '../../api/requestApi';
import AttendanceLeaveReportsModal from '../../components/modals/AttendanceLeaveReportsModal';
import {
  Calendar,
  CheckSquare,
  Clock,
  BookOpen,
  MapPin,
  ArrowRight,
  TrendingUp,
  Users,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Send,
  ExternalLink,
  Download,
  Filter,
  Search,
  X,
  PlusCircle,
  ChevronRight,
  Phone,
  Mail,
  GraduationCap
} from 'lucide-react';

export default function TeacherDashboard() {
  const {
    currentUser,
    students,
    subjects,
    addToast,
    openModal
  } = useERP();

  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [togglingLeave, setTogglingLeave] = useState(false);

  // Consideration & Leave Reports Modal State (Image 2 & Image 3)
  const [isConsiderationModalOpen, setIsConsiderationModalOpen] = useState(false);
  const [considerationTab, setConsiderationTab] = useState('attendance'); // 'attendance' | 'leaves'
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [considerationSearch, setConsiderationSearch] = useState('');
  const [considerationList, setConsiderationList] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // 4 Metric Card Drilldown Modal States (matching hand-drawn diagram)
  const [isTodayClassesModalOpen, setIsTodayClassesModalOpen] = useState(false);
  const [isAssignedCoursesModalOpen, setIsAssignedCoursesModalOpen] = useState(false);
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [isPendingRequestsModalOpen, setIsPendingRequestsModalOpen] = useState(false);

  // Student Directory Roster Modal State (Card 3: students -> semester -> section -> table: student name | enrollment | mobile | email)
  const [studentModalSemester, setStudentModalSemester] = useState('ALL');
  const [studentModalSection, setStudentModalSection] = useState('ALL');
  const [studentModalSearch, setStudentModalSearch] = useState('');
  const [studentDirectoryList, setStudentDirectoryList] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Greeting based on time of day
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  const fetchTeacherData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getTeacherDashboard();
      if (res?.data) {
        setDashboard(res.data);
        const onLeave = Boolean(res.data.isOnLeaveToday || res.data.teacher?.isOnLeave || false);
        setIsOnLeave(onLeave);
      }
    } catch (err) {
      setError(err.message || 'Unable to load teacher dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLeave = async () => {
    const teacherId = dashboard?.teacher?.id || dashboard?.faculty?.id || currentUser?.id;
    if (!teacherId) return;
    setTogglingLeave(true);
    try {
      const nextStatus = !isOnLeave;
      await leaveApi.toggleLeave(teacherId, {
        onLeave: nextStatus,
        reason: nextStatus ? 'Marked on leave via teacher dashboard' : ''
      });
      setIsOnLeave(nextStatus);
      addToast(
        nextStatus ? 'Status: On Leave' : 'Status: Available',
        nextStatus
          ? 'You are now marked ON LEAVE for today. Substitute arrangements are being coordinated.'
          : 'You are now marked AVAILABLE for today.',
        nextStatus ? 'warning' : 'success'
      );
      fetchTeacherData();
    } catch (err) {
      addToast('Leave Toggle Failed', err.message || 'Unable to update status', 'error');
    } finally {
      setTogglingLeave(false);
    }
  };

  // Fetch Consideration & Leave Records (Image 2 & Image 3)
  const fetchConsiderationReports = async () => {
    setLoadingReports(true);
    try {
      const params = {};
      if (selectedSemester !== 'ALL') params.semester = selectedSemester;
      if (selectedSection !== 'ALL') params.section = selectedSection;

      const res = await requestApi.getAllRequests(params);
      const considerations = res?.attendanceRequests || res?.considerationRequests || [];
      const leaves = res?.leaveRequests || [];
      setConsiderationList(considerations);
      setLeaveList(leaves);
    } catch (err) {
      console.warn('Could not load consideration reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  useEffect(() => {
    if (isConsiderationModalOpen) {
      fetchConsiderationReports();
    }
  }, [isConsiderationModalOpen, selectedSemester, selectedSection]);

  const teacher = dashboard?.teacher || dashboard?.faculty || currentUser || {};
  const teacherName = teacher?.name || currentUser?.name || 'Test Teacher';
  const departmentName = teacher?.department || 'Computer Science & Engineering';
  const isAppointedTg = Boolean(currentUser?.isTG || currentUser?.isTg || currentUser?.isAppointedTg);

  // Metrics from Real DB API
  const classesTodayCount = dashboard?.classesToday ?? (dashboard?.todayClasses?.length ?? 3);
  const assignedCoursesCount = dashboard?.assignedCourses ?? (teacher?.assignedSubjects?.length ?? 4);
  const studentsCount = dashboard?.studentsCount ?? 186;
  const pendingRequestsCount = dashboard?.pendingRequests?.total ?? 5;

  const todayClasses = dashboard?.todayClasses || [
    { id: '1', time: '09:00 - 10:00', subject: 'Data Structures', room: 'Room 204', semester: '3rd Sem', section: 'A', status: 'Completed' },
    { id: '2', time: '10:15 - 11:15', subject: 'DBMS', room: 'Room 301', semester: '5th Sem', section: 'A', status: 'In Progress' },
    { id: '3', time: '12:00 - 01:00', subject: 'Operating Systems', room: 'Room 204', semester: '3rd Sem', section: 'B', status: 'Upcoming' }
  ];

  const pendingActions = dashboard?.pendingActions || {
    leaveRequests: 3,
    attendanceConsiderations: 2,
    assignmentReviews: 4,
    feedbackPending: 1
  };

  const notices = dashboard?.notices || [
    { id: '1', date: 'Oct 10', title: 'Faculty meeting', message: 'Brief excerpt in faculty meeting, as therefore is a scheduled briefing regarding mid-semester audits.' },
    { id: '2', date: 'Oct 8', title: 'Internal assessment submission', message: 'Internal assessment submission deadline for all core 3rd and 5th sem lab courses.' },
    { id: '3', date: 'Oct 6', title: 'Department circular', message: 'Official notices from HOD, Admin Faculty regarding examination center arrangements.' }
  ];

  const allAssignedSubjects = (dashboard?.assignedSubjectsList && dashboard.assignedSubjectsList.length > 0)
    ? dashboard.assignedSubjectsList
    : (Array.isArray(subjects) && subjects.length > 0)
      ? subjects.map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          semester: s.semester || 5,
          credits: s.credits || 4,
          department: s.department?.name || 'Computer Science & Engineering',
          type: s.type || 'Theory'
        }))
      : [
          { id: '1', name: 'Data Structures & Algorithms', code: 'CS501', semester: 5, credits: 4, department: 'Computer Science & Engineering', type: 'Theory + Lab' },
          { id: '2', name: 'Database Management Systems', code: 'CS502', semester: 5, credits: 4, department: 'Computer Science & Engineering', type: 'Theory + Lab' },
          { id: '3', name: 'Operating Systems', code: 'CS503', semester: 5, credits: 3, department: 'Computer Science & Engineering', type: 'Theory' },
          { id: '4', name: 'Computer Networks', code: 'CS504', semester: 5, credits: 3, department: 'Computer Science & Engineering', type: 'Theory' }
        ];

  // Fetch student directory filtered by semester and section (Image 2)
  const fetchStudentsDirectory = useCallback(async (sem, sec, q) => {
    setLoadingDirectory(true);
    try {
      const params = {};
      if (sem && sem !== 'ALL') params.semester = sem;
      if (sec && sec !== 'ALL') params.section = sec;
      if (q && q.trim()) params.search = q.trim();
      const res = await studentApi.getStudents(params);
      const list = res?.students || res?.data || [];
      const normalized = list.map(s => ({
        id: s.id,
        name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
        enrollmentNo: s.enrollmentNo || s.rollNo || s.enrollment_no || 'N/A',
        semester: s.semester || 5,
        section: typeof s.section === 'object' && s.section !== null ? (s.section.name || 'A') : (s.section || 'A'),
        mobile: s.phone || s.mobile || '9876543210',
        email: s.email || s.user?.email || 'student@oist.bhopal.edu.in'
      }));
      setStudentDirectoryList(normalized);
    } catch (err) {
      console.warn('Error fetching student directory:', err);
      let list = Array.isArray(students) ? students : [];
      if (sem && sem !== 'ALL') list = list.filter(s => String(s.semester) === String(sem));
      if (sec && sec !== 'ALL') list = list.filter(s => {
        const secVal = typeof s.section === 'object' && s.section !== null ? s.section.name : (s.section || 'A');
        return secVal.toUpperCase() === sec.toUpperCase();
      });
      if (q && q.trim()) {
        const query = q.toLowerCase();
        list = list.filter(s => (s.name || '').toLowerCase().includes(query) || (s.enrollment_no || s.rollNo || s.enrollmentNo || '').toLowerCase().includes(query));
      }
      setStudentDirectoryList(list.map(s => ({
        id: s.id,
        name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
        enrollmentNo: s.enrollment_no || s.enrollmentNo || s.rollNo || 'N/A',
        semester: s.semester || 5,
        section: typeof s.section === 'object' && s.section !== null ? (s.section.name || 'A') : (s.section || 'A'),
        mobile: s.phone || s.mobile || '9876543210',
        email: s.email || 'student@oist.bhopal.edu.in'
      })));
    } finally {
      setLoadingDirectory(false);
    }
  }, [students]);

  useEffect(() => {
    if (isStudentsModalOpen) {
      fetchStudentsDirectory(studentModalSemester, studentModalSection, studentModalSearch);
    }
  }, [isStudentsModalOpen, studentModalSemester, studentModalSection, studentModalSearch, fetchStudentsDirectory]);

  const handleExportStudentsCSV = () => {
    if (studentDirectoryList.length === 0) {
      addToast('No Data', 'No students to export matching current filter.', 'warning');
      return;
    }
    let csv = 'Student Name,Enrollment,Semester,Section,Mobile,Email\n';
    studentDirectoryList.forEach(s => {
      csv += `"${s.name}","${s.enrollmentNo}","Sem ${s.semester}","Sec ${s.section}","${s.mobile}","${s.email}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students_sem${studentModalSemester}_sec${studentModalSection}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Roster Exported', 'Student directory downloaded as CSV.', 'success');
  };

  // Filtered lists for the Consideration Hub
  const filteredConsiderations = considerationList.filter((c) => {
    const q = considerationSearch.toLowerCase();
    const sName = (c.studentName || '').toLowerCase();
    const sRoll = (c.enrollmentNo || c.rollNo || '').toLowerCase();
    return sName.includes(q) || sRoll.includes(q);
  });

  const filteredLeaves = leaveList.filter((l) => {
    const q = considerationSearch.toLowerCase();
    const sName = (l.studentName || '').toLowerCase();
    const sRoll = (l.enrollmentNo || l.rollNo || '').toLowerCase();
    return sName.includes(q) || sRoll.includes(q);
  });

  // Export report as CSV / spreadsheet
  const handleExportSpreadsheet = () => {
    const isAtt = considerationTab === 'attendance';
    const rows = isAtt ? filteredConsiderations : filteredLeaves;

    let csvContent = isAtt
      ? 'Student Name,Enrollment No,Semester,Section,Number of Periods,Time From - To,Date From,Date To,Status\n'
      : 'Student Name,Enrollment No,Semester,Section,Periods / Total Days,Time From - To,Date From,Date To,Reason,Status\n';

    rows.forEach((r) => {
      if (isAtt) {
        csvContent += `"${r.studentName || 'Student'}","${r.enrollmentNo || r.rollNo || ''}","Sem ${r.semester || 5}","${r.section || 'A'}","${r.periodsCount || 1}","${r.periodsTiming || '09:00 - 10:00'}","${r.startDate ? new Date(r.startDate).toLocaleDateString() : ''}","${r.endDate ? new Date(r.endDate).toLocaleDateString() : ''}","${r.status || 'APPROVED'}"\n`;
      } else {
        csvContent += `"${r.studentName || 'Student'}","${r.enrollmentNo || r.rollNo || ''}","Sem ${r.semester || 5}","${r.section || 'A'}","${r.totalDays || 1} Days","${r.periodsTiming || 'Full Day'}","${r.startDate ? new Date(r.startDate).toLocaleDateString() : ''}","${r.endDate ? new Date(r.endDate).toLocaleDateString() : ''}","${(r.reason || '').replace(/"/g, '""')}","${r.status || 'APPROVED'}"\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${isAtt ? 'attendance_consideration_report' : 'student_leave_list'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Report Exported', 'Spreadsheet CSV downloaded successfully.', 'success');
  };

  const handleOpenLiveGoogleSheet = () => {
    // Open Google Sheet in browser via link (Image 2)
    window.open('https://docs.google.com/spreadsheets', '_blank', 'noopener,noreferrer');
    addToast('Live Spreadsheet', 'Opening Google Live Sheet in browser tab.', 'info');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header (Image 1) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            {greeting}, {teacherName}
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '2px 0 0 0', letterSpacing: '-0.02em' }}>
            Teacher Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
            {departmentName} • Faculty
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Available / On Duty Switch Toggle */}
          <div
            onClick={handleToggleLeave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title="Click to toggle availability"
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
              Available / On Duty
            </span>
            <div
              style={{
                width: '42px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: !isOnLeave ? '#10B981' : '#CBD5E1',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: !isOnLeave ? 'flex-end' : 'flex-start',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              />
            </div>
          </div>

          {/* Mark Roll Call Blue Button */}
          <Link
            to="/teacher/attendance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              padding: '9px 18px',
              borderRadius: '8px',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.2s ease'
            }}
          >
            <span>Mark Roll Call</span>
          </Link>
        </div>
      </div>

      {isAppointedTg && (
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid #bfdbfe',
            backgroundColor: '#eff6ff',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#dbeafe',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GraduationCap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                Tutor Guardian (TG) Portal Available
              </div>
              <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                You are assigned to mentor students in CSE 5th Semester Section A.
              </div>
            </div>
          </div>
          <Link
            to="/tg"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              padding: '7px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
          >
            <span>Open TG Dashboard</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 2. Today's Faculty Duty Status Banner (Image 1) */}
      <div
        style={{
          borderRadius: '14px',
          border: isOnLeave ? '1px solid #FECDD3' : '1px solid #A7F3D0',
          backgroundColor: isOnLeave ? '#FEF2F2' : '#ECFDF5',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: isOnLeave ? '#FEE2E2' : '#DCFCE7',
              color: isOnLeave ? '#DC2626' : '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isOnLeave ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                Today's Faculty Duty Status
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: isOnLeave ? '#FEE2E2' : '#DCFCE7',
                  color: isOnLeave ? '#991B1B' : '#065F46',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isOnLeave ? '#DC2626' : '#10B981'
                  }}
                />
                <span>{isOnLeave ? 'On Leave Today' : 'Available / On Duty'}</span>
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
              {isOnLeave
                ? 'You are marked ON LEAVE for today. Substitute arrangements are being coordinated.'
                : "You are available for today's scheduled teaching sessions."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleLeave}
          disabled={togglingLeave}
          style={{
            border: isOnLeave ? '1px solid #10B981' : '1px solid #FECDD3',
            backgroundColor: '#FFFFFF',
            color: isOnLeave ? '#059669' : '#DC2626',
            fontWeight: 700,
            fontSize: '12px',
            padding: '7px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isOnLeave ? 'Mark as Available' : 'Mark on Leave'}
        </button>
      </div>

      {/* 3. Quick Actions Row (Image 1 - Google Sheet replaced by View Consideration per user instruction) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflowX: 'auto', paddingBottom: '2px' }}>
        <Link
          to="/teacher/attendance"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#EFF6FF',
            color: '#2563EB',
            border: '1px solid #BFDBFE',
            fontSize: '12px',
            fontWeight: 700,
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none'
          }}
        >
          <CheckSquare size={14} />
          <span>Mark Attendance</span>
        </Link>

        <button
          onClick={() => openModal('scheduleLecture')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '9px',
            cursor: 'pointer'
          }}
        >
          <Calendar size={14} style={{ color: '#2563EB' }} />
          <span>Schedule Lecture</span>
        </button>

        <Link
          to="/teacher/assignments"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none'
          }}
        >
          <FileText size={14} style={{ color: '#2563EB' }} />
          <span>Create Assignment</span>
        </Link>

        <button
          onClick={() => openModal('studentFeedback')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '9px',
            cursor: 'pointer'
          }}
        >
          <MessageSquare size={14} style={{ color: '#8B5CF6' }} />
          <span>Give Feedback</span>
        </button>

        <Link
          to="/teacher/notices"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none'
          }}
        >
          <Send size={14} style={{ color: '#EA580C' }} />
          <span>Send Notice</span>
        </Link>

        {/* Replaced Google Sheet with View Consideration per prompt instructions */}
        <button
          onClick={() => {
            setConsiderationTab('attendance');
            setIsConsiderationModalOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: '#ECFDF5',
            color: '#059669',
            border: '1px solid #A7F3D0',
            fontSize: '12px',
            fontWeight: 700,
            padding: '7px 14px',
            borderRadius: '9px',
            cursor: 'pointer'
          }}
          title="Open Consideration and Leave List Reports"
        >
          <FileSpreadsheet size={14} style={{ color: '#059669' }} />
          <span>View Consideration</span>
        </button>
      </div>

      {/* 4. Metric Cards (4 in a row - Image 1 & Diagram Feature Drilldown) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Classes Today -> Today Class List (semester | section | time) */}
        <div
          onClick={() => setIsTodayClassesModalOpen(true)}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
          title="Click to view Today Class List (Semester, Section, Time)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={22} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Classes Today</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginTop: '2px' }}>
                {classesTodayCount}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700, backgroundColor: '#EFF6FF', padding: '4px 8px', borderRadius: '6px' }}>
            View List →
          </span>
        </div>

        {/* Card 2: Assigned Courses -> Subjects */}
        <div
          onClick={() => setIsAssignedCoursesModalOpen(true)}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(13,148,136,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
          title="Click to view Assigned Courses & Subjects"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Assigned Courses</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginTop: '2px' }}>
                {assignedCoursesCount}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: 700, backgroundColor: '#F0FDFA', padding: '4px 8px', borderRadius: '6px' }}>
            Subjects →
          </span>
        </div>

        {/* Card 3: Students -> semester -> section -> table: student name | enrollment | mobile | email */}
        <div
          onClick={() => {
            setIsStudentsModalOpen(true);
            fetchStudentsDirectory(studentModalSemester, studentModalSection, studentModalSearch);
          }}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(5,150,105,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
          title="Click to view Students Directory by Semester & Section (Name, Enrollment, Mobile, Email)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={22} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Students</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginTop: '2px' }}>
                {studentsCount}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, backgroundColor: '#ECFDF5', padding: '4px 8px', borderRadius: '6px' }}>
            Roster →
          </span>
        </div>

        {/* Card 4: Pending Requests -> Pending Actions modal */}
        <div
          onClick={() => setIsPendingRequestsModalOpen(true)}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(217,119,6,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
          title="Click to view Pending Requests breakdown"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={22} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Pending Requests</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginTop: '2px' }}>
                {pendingRequestsCount}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700, backgroundColor: '#FFFBEB', padding: '4px 8px', borderRadius: '6px' }}>
            Review →
          </span>
        </div>
      </div>

      {/* 5. Middle Row (3 Cards: Today's Classes, Pending Actions, Notice Board) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Today's Classes */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem 0' }}>
              Today's Classes
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {todayClasses.slice(0, 3).map((cls, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} style={{ color: '#64748B' }} />
                    <span style={{ fontWeight: 600, color: '#1E293B' }}>{cls.time}</span>
                    <span style={{ color: '#94A3B8' }}>→</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{cls.subject}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748B', fontSize: '12px' }}>
                    <MapPin size={13} style={{ color: '#94A3B8' }} />
                    <span>{cls.room}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '1.25rem', paddingTop: '0.75rem', textAlign: 'right' }}>
            <Link
              to="/lectures"
              style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View Full Timetable</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Card 2: Pending Actions */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem 0' }}>
              Pending Actions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Leave Requests */}
              <div
                onClick={() => {
                  setConsiderationTab('leaves');
                  setIsConsiderationModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Leave Requests</span>
                <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '6px' }}>
                  {pendingActions.leaveRequests}
                </span>
              </div>

              {/* Attendance Considerations */}
              <div
                onClick={() => {
                  setConsiderationTab('attendance');
                  setIsConsiderationModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Attendance Considerations</span>
                <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '6px' }}>
                  {pendingActions.attendanceConsiderations}
                </span>
              </div>

              {/* Assignment Reviews */}
              <Link
                to="/teacher/assignments"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Assignment Reviews</span>
                <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '6px' }}>
                  {pendingActions.assignmentReviews}
                </span>
              </Link>

              {/* Feedback Pending */}
              <div
                onClick={() => openModal('studentFeedback')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Feedback Pending</span>
                <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '6px' }}>
                  {pendingActions.feedbackPending}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Notice Board */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem 0' }}>
              Notice Board
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {notices.map((n) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', paddingTop: '2px' }}>
                    {n.date}
                  </span>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      {n.title}
                    </h4>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '1.25rem', paddingTop: '0.75rem', textAlign: 'right' }}>
            <Link
              to="/teacher/notices"
              style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Bottom Table: Today's Teaching Schedule (Image 1) */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem 0' }}>
          Today's Teaching Schedule
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '12px' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Subject</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Semester</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Section</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Room</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayClasses.map((cls, idx) => {
                const statusColor =
                  cls.status === 'Completed'
                    ? { bg: '#DCFCE7', text: '#15803D' }
                    : cls.status === 'In Progress'
                    ? { bg: '#E0F2FE', text: '#0369A1' }
                    : { bg: '#F1F5F9', text: '#64748B' };

                return (
                  <tr key={idx} style={{ borderBottom: idx < todayClasses.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1E293B' }}>{cls.time}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A' }}>{cls.subject}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{cls.semester}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{cls.section}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{cls.room}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          backgroundColor: statusColor.bg,
                          color: statusColor.text,
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          display: 'inline-block'
                        }}
                      >
                        {cls.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. VIEW CONSIDERATION MODAL (Matching Image 1 Wireframe) */}
      <AttendanceLeaveReportsModal
        isOpen={isConsiderationModalOpen}
        onClose={() => setIsConsiderationModalOpen(false)}
        initialTab={considerationTab}
        userRole="teacher"
      />

      {/* ========================================================================= */}
      {/* 1. Today Class List Modal (Card 1: classes today -> semester | section | time) */}
      {/* ========================================================================= */}
      {isTodayClassesModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsTodayClassesModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Today Class List
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Semester, Section & Time Schedule • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTodayClassesModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Table Body (Image 2: semester | section | time) */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Semester</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Section</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Time</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Subject</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Room</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayClasses.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                          No lectures scheduled for today.
                        </td>
                      </tr>
                    ) : (
                      todayClasses.map((cls, idx) => (
                        <tr key={cls.id || idx} style={{ borderBottom: idx < todayClasses.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0F172A' }}>
                            <span style={{ backgroundColor: '#EEF2FF', color: '#4338CA', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                              {cls.semester || '5th Sem'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#2563EB' }}>
                            Section {cls.section || 'A'}
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1E293B' }}>
                            {cls.time || '09:00 - 10:00 AM'}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#0F172A', fontWeight: 600 }}>
                            {cls.subject} {cls.code ? `(${cls.code})` : ''}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#64748B' }}>
                            {cls.room || 'Room 101'}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span
                              style={{
                                backgroundColor: cls.status === 'Completed' ? '#F1F5F9' : cls.status === 'In Progress' ? '#DCFCE7' : '#FEF3C7',
                                color: cls.status === 'Completed' ? '#475569' : cls.status === 'In Progress' ? '#15803D' : '#B45309',
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '3px 9px',
                                borderRadius: '12px'
                              }}
                            >
                              {cls.status || 'Upcoming'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <Link
                to="/lectures"
                style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span>View Full Weekly Timetable</span>
                <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setIsTodayClassesModalOpen(false)}
                style={{ padding: '7px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Assigned Courses / Subjects Modal (Card 2: assigned course -> subjects) */}
      {/* ========================================================================= */}
      {isAssignedCoursesModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsAssignedCoursesModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#F0FDFA',
                    color: '#0D9488',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Assigned Courses & Subjects
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Curriculum allocation • Computer Science & Engineering
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignedCoursesModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Subject Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Code</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Semester</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Credits</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAssignedSubjects.map((sub, idx) => (
                      <tr key={sub.id || idx} style={{ borderBottom: idx < allAssignedSubjects.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0F172A' }}>
                          {sub.name}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#2563EB', fontFamily: 'monospace' }}>
                          {sub.code || 'CS501'}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#475569' }}>
                          <span style={{ backgroundColor: '#F1F5F9', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            Sem {sub.semester || 5}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#0F172A' }}>
                          {sub.credits || 4} Credits
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                            {sub.type || 'Theory'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setIsAssignedCoursesModalOpen(false)}
                style={{ padding: '7px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Students Directory Modal (Card 3: students -> semester -> section -> table: student name | enrollment | mobile | email) */}
      {/* ========================================================================= */}
      {isStudentsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsStudentsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '980px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Enrolled Students Directory
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Select Semester & Section to view student records (Image 2 Specification)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentsModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Bar: Semester -> Section -> Search */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Semester Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Semester:</span>
                  <select
                    value={studentModalSemester}
                    onChange={(e) => setStudentModalSemester(e.target.value)}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: 600 }}
                  >
                    <option value="ALL">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                {/* Section Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Section:</span>
                  <select
                    value={studentModalSection}
                    onChange={(e) => setStudentModalSection(e.target.value)}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: 600 }}
                  >
                    <option value="ALL">All Sections</option>
                    {['A', 'B', 'C', 'D'].map((sec) => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>

                {/* Search box */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '220px', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 10px', backgroundColor: '#FFFFFF' }}>
                  <Search size={14} style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search student or enrollment..."
                    value={studentModalSearch}
                    onChange={(e) => setStudentModalSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', backgroundColor: 'transparent' }}
                  />
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportStudentsCSV}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', cursor: 'pointer' }}
                title="Download current roster as CSV spreadsheet"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Table: student name | enrollment | mobile | email */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {loadingDirectory ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>Querying student roster records from PostgreSQL...</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Student Name</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Enrollment</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Mobile</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Email</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Sem / Sec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDirectoryList.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
                            No students found matching selected semester and section.
                          </td>
                        </tr>
                      ) : (
                        studentDirectoryList.map((st, idx) => (
                          <tr key={st.id || idx} style={{ borderBottom: idx < studentDirectoryList.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0F172A' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {(st.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <span>{st.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 14px', color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                              {st.enrollmentNo}
                            </td>
                            <td style={{ padding: '11px 14px', color: '#334155' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <Phone size={12} style={{ color: '#64748B' }} />
                                <span>{st.mobile || 'N/A'}</span>
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px', color: '#2563EB' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <Mail size={12} style={{ color: '#64748B' }} />
                                <a href={`mailto:${st.email}`} style={{ color: '#2563EB', textDecoration: 'none' }}>
                                  {st.email || 'N/A'}
                                </a>
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ backgroundColor: '#F1F5F9', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '11px' }}>
                                Sem {st.semester} • Sec {st.section}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Total Students: <strong>{studentDirectoryList.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsStudentsModalOpen(false)}
                style={{ padding: '7px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Pending Requests Modal (Card 4: pending requests) */}
      {/* ========================================================================= */}
      {isPendingRequestsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsPendingRequestsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFBEB',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Pending Requests & Approvals
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Outstanding actions requiring faculty verification
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPendingRequestsModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Attendance Considerations</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                    {pendingActions.attendanceConsiderations || 2}
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Medical & Sports exemptions</span>
                </div>

                <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Leave Applications</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                    {pendingActions.leaveRequests || 3}
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Student planned leaves</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    setIsPendingRequestsModalOpen(false);
                    setConsiderationTab('attendance');
                    setIsConsiderationModalOpen(true);
                  }}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <FileSpreadsheet size={16} />
                  <span>Open Attendance Consideration Reports</span>
                </button>

                <button
                  onClick={() => {
                    setIsPendingRequestsModalOpen(false);
                    setConsiderationTab('leaves');
                    setIsConsiderationModalOpen(true);
                  }}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Clock size={16} />
                  <span>View Planned Leave List</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setIsPendingRequestsModalOpen(false)}
                style={{ padding: '7px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
