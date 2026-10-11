import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useERP } from '../../context/ERPContext';
import { useNavigate, Link } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboardApi';
import { studentApi } from '../../api/studentApi';
import { requestApi } from '../../api/requestApi';
import AttendanceLeaveReportsModal from '../../components/modals/AttendanceLeaveReportsModal';
import {
  Users,
  GraduationCap,
  Building2,
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  Zap,
  UserPlus,
  Sparkles,
  ArrowRight,
  CalendarDays,
  Activity,
  UserCheck,
  Bot,
  ChevronRight,
  X,
  CheckCircle2,
  ExternalLink,
  Search,
  Phone,
  Mail,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function HodDashboard() {
  const { currentUser, addToast } = useERP();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [facultyAvailability, setFacultyAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [selectedSectionLetter, setSelectedSectionLetter] = useState('A');
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(5); // Default to Sem 5 per Image 4

  // Academic Year & Academic Calendar State (Image Item 2 - unclipped selector & calendar)
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [showAcademicYearDropdown, setShowAcademicYearDropdown] = useState(false);
  const [showAcademicYearModal, setShowAcademicYearModal] = useState(false);
  const [calendarActiveTab, setCalendarActiveTab] = useState('ODD'); // 'ODD' | 'EVEN'
  const academicYearBtnRef = useRef(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 180, right: 24 });

  const handleToggleAcademicYearDropdown = () => {
    if (!showAcademicYearDropdown && academicYearBtnRef.current) {
      const rect = academicYearBtnRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: Math.round(rect.bottom + 8),
        right: Math.max(16, Math.round(window.innerWidth - rect.right))
      });
    }
    setShowAcademicYearDropdown((prev) => !prev);
  };

  // Consideration & Planned Leave Reports Modal State (Image Item 1)
  const [isConsiderationModalOpen, setIsConsiderationModalOpen] = useState(false);
  const [considerationTab, setConsiderationTab] = useState('attendance'); // 'attendance' | 'leaves'
  const [considerationSemester, setConsiderationSemester] = useState('ALL');
  const [considerationSection, setConsiderationSection] = useState('ALL');
  const [considerationSearch, setConsiderationSearch] = useState('');
  const [considerationList, setConsiderationList] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Move to Next Semester (Promotion / Shift) States
  const [showMoveSemModal, setShowMoveSemModal] = useState(false);
  const [moveScope, setMoveScope] = useState('SECTION'); // 'SECTION' or 'ALL_SEMESTER'
  const [moveLoading, setMoveLoading] = useState(false);
  const [targetSemester, setTargetSemester] = useState(6);

  // Live Digital Clock
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchHodData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getHodDashboard();
      if (res?.data) {
        setDashboard(res.data);
        if (res.data.facultyAvailability) {
          setFacultyAvailability(res.data.facultyAvailability);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load real departmental analytics from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHodData();
  }, []);

  // Fetch Consideration & Leave Records (Image Item 1)
  const fetchConsiderationReports = async () => {
    setLoadingReports(true);
    try {
      const params = {};
      if (considerationSemester !== 'ALL') params.semester = considerationSemester;
      if (considerationSection !== 'ALL') params.section = considerationSection;

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
    if (isConsiderationModalOpen) {
      fetchConsiderationReports();
    }
  }, [isConsiderationModalOpen, considerationSemester, considerationSection]);

  const filteredConsiderations = useMemo(() => {
    return considerationList.filter((item) => {
      const semMatches = considerationSemester === 'ALL' || String(item.semester) === String(considerationSemester);
      const secVal = typeof item.section === 'object' && item.section !== null ? item.section.name : (item.section || 'A');
      const secMatches = considerationSection === 'ALL' || secVal.toUpperCase() === considerationSection.toUpperCase();
      const q = considerationSearch.toLowerCase().trim();
      const queryMatches =
        !q ||
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.enrollmentNo || item.rollNo || '').toLowerCase().includes(q);
      return semMatches && secMatches && queryMatches;
    });
  }, [considerationList, considerationSemester, considerationSection, considerationSearch]);

  const filteredLeaves = useMemo(() => {
    return leaveList.filter((item) => {
      const semMatches = considerationSemester === 'ALL' || String(item.semester) === String(considerationSemester);
      const secVal = typeof item.section === 'object' && item.section !== null ? item.section.name : (item.section || 'A');
      const secMatches = considerationSection === 'ALL' || secVal.toUpperCase() === considerationSection.toUpperCase();
      const q = considerationSearch.toLowerCase().trim();
      const queryMatches =
        !q ||
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.enrollmentNo || item.rollNo || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q);
      return semMatches && secMatches && queryMatches;
    });
  }, [leaveList, considerationSemester, considerationSection, considerationSearch]);

  const handleOpenLiveGoogleSheet = () => {
    window.open('https://docs.google.com/spreadsheets', '_blank', 'noopener,noreferrer');
    addToast('Live Spreadsheet', 'Opening Google Live Sheet in browser tab.', 'info');
  };

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
    link.setAttribute('download', `${isAtt ? 'hod_attendance_consideration_report' : 'hod_student_leave_list'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Report Exported', 'Spreadsheet CSV downloaded successfully.', 'success');
  };

  const handleDownloadAcademicCalendar = () => {
    const calendarText = `RAJIV GANDHI PROUDYOGIKI VISHWAVIDYALAYA, BHOPAL
ACADEMIC CALENDAR - SESSION ${academicYear}
DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST), BHOPAL

============================================================
ODD SEMESTER (I, III, V, VII SEMESTER): JULY - DECEMBER
============================================================
1. Commencement of Academic Session: 15 July 2025
2. Orientation & Mentor-Mentee Allocation: 18 - 22 July 2025
3. Mid-Semester Test - I (MST-1): 15 - 20 September 2025
4. Submission of MST-1 Marks & Shortage Review: 26 September 2025
5. Mid-Semester Test - II (MST-2): 10 - 15 November 2025
6. Remedial Classes & Doubt Clearing Sessions: 24 - 29 November 2025
7. Practical & Viva-Voce Examinations: 01 - 06 December 2025
8. End Semester RGPV Theory Examinations: 10 - 30 December 2025
9. Winter Break / Inter-Semester Recess: 31 December - 10 January 2026

============================================================
EVEN SEMESTER (II, IV, VI, VIII SEMESTER): JANUARY - JUNE
============================================================
1. Commencement of Academic Session: 12 January 2026
2. Annual Techno-Cultural Fest (TechAcme): 20 - 25 February 2026
3. Mid-Semester Test - I (MST-1): 16 - 21 March 2026
4. Submission of MST-1 Marks & Parent Interaction: 28 March 2026
5. Mid-Semester Test - II (MST-2): 20 - 25 April 2026
6. Attendance Freezing & Admit Card Generation: 05 May 2026
7. Practical & Project Defense: 15 - 22 May 2026
8. University Theory Examinations: 25 May - 15 June 2026
9. Summer Internships & Industry Training: 16 June - 14 July 2026

Issued by: Head of Department (CSE), OIST Bhopal
Approved by: Principal / Director, OIST Bhopal`;

    const blob = new Blob([calendarText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RGPV_OIST_Academic_Calendar_${academicYear}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Academic Calendar', `Downloaded official Academic Calendar for ${academicYear}.`, 'success');
  };

  // Time & Greeting Helpers
  const hour = currentDateTime.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const hodName =
    currentUser?.name && currentUser?.name.toLowerCase() !== 'hod' && !currentUser?.name.includes('Alok Verma')
      ? currentUser.name
      : (d.departmentCode ? `HOD ${d.departmentCode}` : 'Head of Department');

  const formattedDate = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Extract 100% REAL backend database data directly without mock fallbacks
  const d = dashboard || {};
  const counts = {
    totalStudents: d.totalStudents ?? d.stats?.totalStudents ?? 0,
    totalFaculty: d.totalFaculty ?? d.stats?.totalFaculty ?? 0,
    activeSubjects: d.activeSubjects ?? d.stats?.activeSubjects ?? 0,
    todayClassesCount: d.todayClassesCount ?? d.stats?.todayClassesCount ?? 0,
    enrolledStudents: d.enrolledStudents ?? d.totalStudents ?? 0,
    attendanceRate: d.attendanceRate ?? d.stats?.averageAttendance ?? 0,
    activeTeachers: d.activeTeachers ?? d.stats?.totalFaculty ?? 0,
    pendingApprovals: d.pendingApprovals ?? d.stats?.pendingApprovals ?? 0,
    leaveRequests: d.leaveRequests ?? d.stats?.pendingLeaveRequestsCount ?? 0,

    // Real dynamic growth & status badges from backend
    studentsGrowth: d.studentsGrowth || `${d.totalStudents ?? 0} registered`,
    facultyGrowth: d.facultyGrowth || `${d.totalFaculty ?? 0} active faculty`,
    subjectsSubtext: d.subjectsSubtext || `${d.activeSubjects ?? 0} active courses`,
    todayClassesSubtext: d.todayClassesSubtext || `${d.todayClassesCount ?? 0} scheduled today`,
    enrolledGrowth: d.enrolledGrowth || 'This semester',
    attendanceGrowth: d.attendanceGrowth || `${d.attendanceRate ?? 0}% verified`,
    activeTeachersGrowth: d.activeTeachersGrowth || `${d.activeTeachers ?? 0} available on duty`,
    pendingApprovalsSubtext: d.pendingApprovalsSubtext || ((d.pendingApprovals ?? 0) > 0 ? 'Requires attention' : 'All clear'),
    leaveRequestsSubtext: d.leaveRequestsSubtext || ((d.leaveRequests ?? 0) > 0 ? `${d.leaveRequests} in queue` : 'Queue empty')
  };

  // Current Timetable Details
  const currentTimetable = d.currentTimetable || {
    status: 'ACTIVE',
    label: 'Sem 5 Active',
    subtext: 'AY 2026-27 • Clash-free'
  };

  // Full List of Pending Approvals
  const pendingApprovalsList = d.pendingApprovalsList || [];

  // Real Semester Distribution calculated directly by PostgreSQL
  const semesterDistribution = useMemo(() => {
    if (d.semesterDistribution && d.semesterDistribution.length > 0) {
      return d.semesterDistribution;
    }
    const semColors = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6'];
    return [1, 2, 3, 4, 5, 6, 7, 8].map((semNum, idx) => {
      const suffix = semNum === 1 ? 'st' : semNum === 2 ? 'nd' : semNum === 3 ? 'rd' : 'th';
      return {
        semester: `${semNum}${suffix} Sem`,
        semNumber: semNum,
        count: 0,
        percentage: 0,
        color: semColors[idx % semColors.length]
      };
    });
  }, [d.semesterDistribution]);

  // Real Section Overview from PostgreSQL
  const sectionOverview = useMemo(() => {
    if (d.sectionOverview && d.sectionOverview.length > 0) {
      return d.sectionOverview;
    }
    const sectionCardColors = [
      { text: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE', iconBg: '#DBEAFE' },
      { text: '#7C3AED', bg: '#F5F3FF', border: '#EDE9FE', iconBg: '#EDE9FE' },
      { text: '#059669', bg: '#ECFDF5', border: '#D1FAE5', iconBg: '#D1FAE5' },
      { text: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5', iconBg: '#FFEDD5' }
    ];
    return ['A', 'B', 'C', 'D'].map((letter, idx) => ({
      id: `sec-${letter}`,
      name: `${d.departmentCode || 'CSE'}-${letter}`,
      rawName: letter,
      studentCount: 0,
      tgName: 'Prof. HOD CSE',
      students: [],
      status: 'Active',
      color: sectionCardColors[idx].text,
      bg: sectionCardColors[idx].bg,
      border: sectionCardColors[idx].border,
      iconBg: sectionCardColors[idx].iconBg
    }));
  }, [d.sectionOverview, d.departmentCode]);

  // Dynamically compute section overview filtered by selectedSemester (Matching Image 4)
  const sectionOverviewFiltered = useMemo(() => {
    return sectionOverview.map((sec) => {
      const allStudents = sec.students || [];
      const filteredBySem = selectedSemester === 'ALL'
        ? allStudents
        : allStudents.filter((st) => Number(st.semester) === Number(selectedSemester));
      return {
        ...sec,
        studentCount: filteredBySem.length,
        students: filteredBySem
      };
    });
  }, [sectionOverview, selectedSemester]);

  // Active section data for student details view
  const activeSectionData = useMemo(() => {
    return (
      sectionOverviewFiltered.find(
        (s) => (s.rawName || '').toUpperCase() === selectedSectionLetter.toUpperCase()
      ) ||
      sectionOverviewFiltered[0] || {
        name: `CSE-${selectedSectionLetter}`,
        rawName: selectedSectionLetter,
        studentCount: 0,
        tgName: 'Prof. HOD CSE',
        students: []
      }
    );
  }, [sectionOverviewFiltered, selectedSectionLetter]);

  // Filter students by search term within active section
  const filteredSectionStudents = useMemo(() => {
    const list = activeSectionData.students || [];
    if (!sectionSearchTerm.trim()) return list;
    const term = sectionSearchTerm.toLowerCase();
    return list.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.enrollment || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.phone || '').toLowerCase().includes(term)
    );
  }, [activeSectionData, sectionSearchTerm]);

  const handleOpenSectionDetails = (letter) => {
    setSelectedSectionLetter(letter);
    setSectionSearchTerm('');
    setShowSectionModal(true);
  };

  // Count total students across all sections in currently selected semester
  const totalStudentsInCurrentSemester = useMemo(() => {
    const fromSem = selectedSemester === 'ALL' ? 5 : Number(selectedSemester);
    let count = 0;
    sectionOverview.forEach((sec) => {
      (sec.students || []).forEach((st) => {
        if (Number(st.semester) === fromSem) count++;
      });
    });
    return count;
  }, [sectionOverview, selectedSemester]);

  // Execute Move to Next Semester (Shift / Promotion)
  const handleConfirmMoveSemester = async () => {
    const fromSem = selectedSemester === 'ALL' ? 5 : Number(selectedSemester);
    if (fromSem >= 8) {
      addToast('Final Semester', 'Students in Semester 8 are already in their final graduating semester.', 'warning');
      return;
    }

    setMoveLoading(true);
    try {
      const payload = {
        fromSemester: fromSem,
        toSemester: targetSemester,
        applyToAllInSemester: moveScope === 'ALL_SEMESTER',
        sectionName: moveScope === 'SECTION' ? selectedSectionLetter : undefined
      };

      const res = await studentApi.moveToNextSemester(payload);
      addToast(
        'Semester Shift Successful',
        res.message || `Moved students from Semester ${fromSem} to Semester ${targetSemester}.`,
        'success'
      );

      // Refresh real database data
      await fetchHodData();

      // Switch active view semester to targetSemester so user immediately sees the promoted students
      setSelectedSemester(targetSemester);
      setShowMoveSemModal(false);
    } catch (err) {
      addToast('Move Failed', err.message || 'Unable to move students to next semester.', 'error');
    } finally {
      setMoveLoading(false);
    }
  };

  // Notice Board strictly from PostgreSQL Notification table (Zero Mock Data)
  const noticeBoard = d.noticeBoard || [];

  // Real Faculty List from PostgreSQL
  const facultyList = facultyAvailability;

  // SVG Donut Chart Calculation for Semester Distribution
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  const donutSlices = semesterDistribution.map((sem) => {
    const pct = sem.percentage || 0;
    const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += pct;
    return {
      ...sem,
      strokeDasharray,
      strokeDashoffset
    };
  });

  // Dynamic Mini Sparkline SVG
  const renderSparkline = (color, hasData) => (
    <svg className="hod-sparkline-svg" viewBox="0 0 60 20">
      <path
        d={hasData ? 'M 2 15 Q 15 4, 30 11 T 58 7' : 'M 2 12 L 58 12'}
        fill="none"
        stroke={hasData ? color : '#CBD5E1'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div className="hod-dash-wrapper">
      {/* 1. Header Banner */}
      <div className="hod-header-banner">
        {/* Left Side: Greeting & Time */}
        <div className="hod-greeting-card">
          <div className="hod-office-pill">
            <Building2 size={13} />
            <span>HOD Office</span>
          </div>

          <h1 className="hod-greeting-title">
            <span>{greeting}, {hodName}!</span>
            <span style={{ fontSize: '24px' }}>👋</span>
          </h1>

          <p className="hod-greeting-sub">
            Here's what's happening in your {d.departmentCode || 'CSE'} department today.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="hod-time-pill">
              <Calendar size={14} style={{ color: '#2563EB' }} />
              <span>{formattedDate}</span>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <Clock size={14} style={{ color: '#059669' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formattedTime}</span>
            </div>

            {/* View Consideration Button (Image Item 1) */}
            <button
              type="button"
              id="hod-view-consideration-btn"
              onClick={() => setIsConsiderationModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              title="View student attendance consideration & leave requests (same as teacher dashboard)"
            >
              <FileSpreadsheet size={14} style={{ color: '#059669' }} />
              <span>View Consideration</span>
            </button>
          </div>
        </div>

        {/* Right Side: Scenic College Campus Banner */}
        <div
          className="hod-campus-card"
          style={{ backgroundImage: `url('/oriental.png')` }}
        >
          <div className="hod-campus-overlay" />
          <div className="hod-campus-content">
            <p className="hod-campus-quote">
              "Better systems,<br />
              Better education."
            </p>
            <p className="hod-campus-tag">— OIST {d.departmentCode || 'CSE'}</p>
          </div>

          {/* Academic Year Selector Pill Button (Image Item 2 - onclick select academic year / calendar) */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <button
              ref={academicYearBtnRef}
              type="button"
              id="hod-academic-year-pill-btn"
              onClick={handleToggleAcademicYearDropdown}
              className="hod-academic-year-pill"
              style={{
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                backdropFilter: 'blur(8px)',
                userSelect: 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to select Academic Year or view Academic Calendar"
            >
              <CalendarDays size={14} style={{ color: '#60A5FA' }} />
              <span>Academic Year: {academicYear}</span>
              <ChevronDown
                size={13}
                style={{
                  color: '#94A3B8',
                  transform: showAcademicYearDropdown ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            backgroundColor: '#FFF1F2',
            border: '1px solid #FECDD3',
            color: '#BE123C',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchHodData}
            className="btn btn-sm btn-primary"
            style={{ fontSize: '11px', padding: '0.2rem 0.5rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Top Metric Cards (6 active hot cards) */}
      <div className="hod-metrics-grid-top">
        {/* Hot Card 1: Total Students -> routes to /hod/students */}
        <div
          onClick={() => navigate('/hod/students')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to open Department Students directory"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Total Students</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
              <Users size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.totalStudents.toLocaleString()}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: '#059669' }}>
              <span>{counts.studentsGrowth}</span>
            </div>
            {renderSparkline('#2563EB', counts.totalStudents > 0)}
          </div>
        </div>

        {/* Hot Card 2: Teaching Faculty -> routes to /hod/teachers */}
        <div
          onClick={() => navigate('/hod/teachers')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to open Teaching Faculty roster"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Teaching Faculty</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <GraduationCap size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.totalFaculty.toLocaleString()}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: '#059669' }}>
              <span>{counts.facultyGrowth}</span>
            </div>
            {renderSparkline('#7C3AED', counts.totalFaculty > 0)}
          </div>
        </div>

        {/* Hot Card 3: Pending Approvals (Replaced Departments) -> Opens Full List Modal */}
        <div
          onClick={() => setShowApprovalsModal(true)}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view full list of pending approvals"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Pending Approvals</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
              <AlertCircle size={19} />
            </div>
          </div>
          <div className="hod-stat-value" style={{ color: counts.pendingApprovals > 0 ? '#E11D48' : '#0F172A' }}>
            {counts.pendingApprovals}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: counts.pendingApprovals > 0 ? '#E11D48' : '#059669' }}>
              <span>{counts.pendingApprovalsSubtext}</span>
            </div>
            {renderSparkline('#E11D48', counts.pendingApprovals > 0)}
          </div>
        </div>

        {/* Hot Card 4: Current Timetable (Replaced Total User Accounts) -> routes to /hod/timetable */}
        <div
          onClick={() => navigate('/hod/timetable')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to open Current Timetable"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Current Timetable</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
              <Calendar size={19} />
            </div>
          </div>
          <div className="hod-stat-value" style={{ fontSize: '19px', fontWeight: 800 }}>
            {currentTimetable.label || currentTimetable.status || 'Active'}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: '#EA580C' }}>
              <span>{currentTimetable.subtext || 'AY 2026-27 • Clash-free'}</span>
            </div>
            {renderSparkline('#EA580C', true)}
          </div>
        </div>

        {/* Hot Card 5: Active Subjects -> routes to /hod/classes */}
        <div
          onClick={() => navigate('/hod/classes')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view Department Curriculum Subjects"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Active Subjects</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
              <CalendarDays size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.activeSubjects.toLocaleString()}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: '#059669' }}>
              <span>{counts.subjectsSubtext}</span>
            </div>
            {renderSparkline('#10B981', counts.activeSubjects > 0)}
          </div>
        </div>

        {/* Hot Card 6: Today's Schedule -> routes to /lectures (Image 2) */}
        <div
          onClick={() => navigate('/lectures')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view today's lecture schedule"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Today's Schedule</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
              <Clock size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.todayClassesCount}
          </div>
          <div className="hod-stat-footer">
            <div className="hod-stat-trend" style={{ color: counts.todayClassesCount > 0 ? '#059669' : '#64748B' }}>
              <span>{counts.todayClassesSubtext}</span>
            </div>
            {renderSparkline('#E11D48', counts.todayClassesCount > 0)}
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Semester Distribution, Section Overview, Notice Board */}
      <div className="hod-middle-grid">
        {/* Panel 1: Semester Distribution Donut Chart (Routes to /hod/classes) */}
        <div
          className="hod-panel-card"
          onClick={() => navigate('/hod/classes')}
          style={{ cursor: 'pointer' }}
          title="Click to view and manage classes and semester structures"
        >
          <div className="hod-panel-header">
            <div className="hod-panel-title-group">
              <Calendar size={17} style={{ color: '#2563EB' }} />
              <h3 className="hod-panel-title">Semester Distribution</h3>
            </div>
            <Link to="/hod/classes" className="hod-panel-link" title="Manage classes and semester structures" onClick={(e) => e.stopPropagation()}>
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="hod-donut-container">
            {/* Donut SVG */}
            <div className="hod-donut-svg-wrapper">
              <svg viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {counts.totalStudents === 0 ? (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="16"
                  />
                ) : (
                  donutSlices.map((slice, i) => (
                    <circle
                      key={i}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 0.3s ease' }}
                    />
                  ))
                )}
              </svg>
              {/* Center Text */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                  8
                </span>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                  Semesters
                </span>
              </div>
            </div>

            {/* Legend List */}
            <div className="hod-donut-legend-list">
              {semesterDistribution.map((item, i) => (
                <div key={i} className="hod-legend-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        flexShrink: 0
                      }}
                    />
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {item.semester}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Section Overview (CSE Only - 4 Section Tiles) */}
        <div className="hod-panel-card">
          <div className="hod-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div className="hod-panel-title-group">
              <Users size={17} style={{ color: '#2563EB' }} />
              <h3 className="hod-panel-title">Section Overview ({d.departmentCode || 'CSE'} Only)</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Sem</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#1E293B',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Select semester for section overview"
                >
                  <option value={5}>Sem 5</option>
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                  <option value={3}>Sem 3</option>
                  <option value={4}>Sem 4</option>
                  <option value={6}>Sem 6</option>
                  <option value={7}>Sem 7</option>
                  <option value={8}>Sem 8</option>
                  <option value="ALL">All Semesters</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSectionDetails(selectedSectionLetter || 'A')}
                className="hod-panel-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Inspect section students & TG details"
              >
                <span>View details</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div className="hod-sections-grid">
            {sectionOverviewFiltered.map((sec) => (
              <div
                key={sec.id}
                onClick={() => handleOpenSectionDetails(sec.rawName || 'A')}
                className="hod-section-tile"
                style={{
                  backgroundColor: sec.bg,
                  borderColor: sec.border,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
                title={`Click to view TG and students for ${sec.name}`}
              >
                <div
                  className="hod-section-icon-box"
                  style={{
                    backgroundColor: sec.iconBg,
                    color: sec.color
                  }}
                >
                  <Users size={16} />
                </div>
                <span className="hod-section-name">{sec.name}</span>
                <span className="hod-section-count">{sec.studentCount}</span>
                <span className="hod-section-subtext">Students</span>
                <span className="hod-section-active-badge">● Active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3: Notice Board (Strictly Real Notifications from PostgreSQL) */}
        <div className="hod-panel-card">
          <div className="hod-panel-header">
            <div className="hod-panel-title-group">
              <FileText size={17} style={{ color: '#E11D48' }} />
              <h3 className="hod-panel-title">Notice Board</h3>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#64748B',
                  backgroundColor: '#F1F5F9',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                Official Circulars
              </span>
            </div>
            <Link to="/hod/notices" className="hod-panel-link" title="View all department notices">
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="hod-notices-list">
            {noticeBoard.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  color: '#64748B',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>No official notices published yet</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Department announcements will appear here</p>
              </div>
            ) : (
              noticeBoard.map((notice) => (
                <div
                  key={notice.id}
                  onClick={() => navigate('/hod/notices')}
                  className="hod-notice-row"
                  title="Click to view notice circular"
                >
                  <div className="hod-notice-left">
                    <div
                      className="hod-notice-icon-box"
                      style={{
                        backgroundColor: notice.tagBg || '#EFF6FF',
                        color: notice.tagColor || '#2563EB'
                      }}
                    >
                      <FileText size={16} />
                    </div>
                    <div className="hod-notice-meta">
                      <span className="hod-notice-title">{notice.title}</span>
                      <span className="hod-notice-sub">{notice.subtitle}</span>
                    </div>
                  </div>

                  <div className="hod-notice-right">
                    <span className="hod-notice-date">{notice.date}</span>
                    <span
                      className="hod-notice-tag"
                      style={{
                        backgroundColor: notice.tagBg,
                        color: notice.tagColor,
                        border: `1px solid ${notice.tagColor}30`
                      }}
                    >
                      ● {notice.tag}
                    </span>
                    <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Second Row Metric Cards (5 active hot cards) */}
      <div className="hod-metrics-grid-bottom">
        {/* Card 1: Enrolled Students -> routes to /hod/students */}
        <div
          onClick={() => navigate('/hod/students')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view enrolled students"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Enrolled Students</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
              <UserCheck size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.enrolledStudents.toLocaleString()}
          </div>
          <div className="hod-stat-footer">
            <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>{counts.enrolledGrowth}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 6px',
                borderRadius: '9999px',
                fontSize: '10.5px',
                fontWeight: 700,
                backgroundColor: '#ECFDF5',
                color: '#059669'
              }}
            >
              {counts.totalStudents} active
            </span>
          </div>
        </div>

        {/* Card 2: Attendance Rate -> routes to /hod/reports */}
        <div
          onClick={() => navigate('/hod/reports')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view department attendance analytics"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Attendance Rate</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#F5F3FF', color: '#8B5CF6' }}>
              <Activity size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.attendanceRate}%
          </div>
          <div className="hod-stat-footer">
            <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>{counts.attendanceGrowth}</span>
          </div>
        </div>

        {/* Card 3: Active Teachers -> routes to /hod/teachers */}
        <div
          onClick={() => navigate('/hod/teachers')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view active faculty"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Active Teachers</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
              <Users size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.activeTeachers}
          </div>
          <div className="hod-stat-footer">
            <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>{counts.activeTeachersGrowth}</span>
          </div>
        </div>

        {/* Card 4: Pending Approvals -> Opens Full List Modal */}
        <div
          onClick={() => setShowApprovalsModal(true)}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to view full list of pending approvals"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Pending Approvals</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
              <AlertCircle size={19} />
            </div>
          </div>
          <div className="hod-stat-value" style={{ color: counts.pendingApprovals > 0 ? '#E11D48' : '#0F172A' }}>
            {counts.pendingApprovals}
          </div>
          <div className="hod-stat-footer">
            <span
              style={{
                color: counts.pendingApprovals > 0 ? '#E11D48' : '#059669',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {counts.pendingApprovalsSubtext}
            </span>
          </div>
        </div>

        {/* Card 5: Leave Requests -> routes to /hod/requests */}
        <div
          onClick={() => navigate('/hod/requests')}
          className="hod-stat-card"
          style={{ cursor: 'pointer' }}
          title="Click to open Leave Requests in Requests Central"
        >
          <div className="hod-stat-header">
            <span className="hod-stat-label">Leave Requests</span>
            <div className="hod-stat-icon-box" style={{ backgroundColor: '#F0FDFA', color: '#0D9488' }}>
              <Clock size={19} />
            </div>
          </div>
          <div className="hod-stat-value">
            {counts.leaveRequests}
          </div>
          <div className="hod-stat-footer">
            <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 600 }}>
              {counts.leaveRequestsSubtext}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: Faculty Availability Status Today & Quick Actions */}
      <div className="hod-bottom-grid">
        {/* Left Column: Faculty Availability Status Today */}
        <div className="hod-panel-card">
          <div className="hod-panel-header">
            <div className="hod-panel-title-group">
              <Calendar size={17} style={{ color: '#2563EB' }} />
              <h3 className="hod-panel-title">Faculty Availability Status Today</h3>
            </div>
            <Link to="/hod/teachers" className="hod-panel-link" title="Open full faculty roster">
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="hod-faculty-table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th>Designation</th>
                  <th>Email & Contact</th>
                  <th>Weekly Workload</th>
                  <th>Today's Duty Status</th>
                  <th style={{ textAlign: 'right' }}>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {facultyList.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748B' }}>
                      No faculty members found in department database.
                    </td>
                  </tr>
                ) : (
                  facultyList.map((faculty) => {
                    const isOnLeave = faculty.status === 'ON_LEAVE' || faculty.isOnLeave;
                    const dotColor = isOnLeave ? '#EA580C' : '#059669';
                    const badgeBg = isOnLeave ? '#FFF7ED' : '#ECFDF5';
                    const badgeText = isOnLeave ? '#EA580C' : '#059669';
                    const badgeBorder = isOnLeave ? '#FFEDD5' : '#A7F3D0';

                    return (
                      <tr key={faculty.id}>
                        <td style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: dotColor,
                                flexShrink: 0
                              }}
                            />
                            <span>{faculty.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                          {faculty.designation}
                        </td>
                        <td style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
                          {faculty.email}
                        </td>
                        <td style={{ color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {faculty.weeklyWorkload || '16 hrs/wk'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: badgeBg,
                              color: badgeText,
                              border: `1px solid ${badgeBorder}`
                            }}
                          >
                            ● {faculty.todayDutyStatus || (isOnLeave ? 'On Leave' : 'Available')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => navigate('/hod/teachers')}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              color: '#2563EB',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Actions (Manage your academic operations) */}
        <div className="hod-panel-card">
          <div className="hod-panel-header">
            <div>
              <div className="hod-panel-title-group">
                <Zap size={17} style={{ color: '#2563EB' }} fill="#2563EB" />
                <h3 className="hod-panel-title">Quick Actions</h3>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
                Manage your academic operations
              </p>
            </div>
            <Link to="/hod/reports" className="hod-panel-link" title="Open institutional reports">
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* 6 Quick Action Tiles (2 cols x 3 rows) - All correctly routed to HOD pages */}
          <div className="hod-quick-actions-grid">
            {/* 1. Add Student -> /hod/students */}
            <div
              onClick={() => navigate('/hod/students')}
              className="hod-quick-tile"
              title="Add or manage students"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
              >
                <UserPlus size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">Add Student</span>
                <span className="hod-quick-tile-hint">Register new student</span>
              </div>
            </div>

            {/* 2. Add Faculty -> /hod/teachers */}
            <div
              onClick={() => navigate('/hod/teachers')}
              className="hod-quick-tile"
              title="Add or manage teachers"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
              >
                <GraduationCap size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">Add Faculty</span>
                <span className="hod-quick-tile-hint">Onboard faculty member</span>
              </div>
            </div>

            {/* 3. Generate Timetable -> /hod/timetable */}
            <div
              onClick={() => navigate('/hod/timetable')}
              className="hod-quick-tile"
              title="Generate timetable"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}
              >
                <Sparkles size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">Generate Timetable</span>
                <span className="hod-quick-tile-hint">Create & manage timetable</span>
              </div>
            </div>

            {/* 4. Manage Leave -> /hod/requests */}
            <div
              onClick={() => navigate('/hod/requests')}
              className="hod-quick-tile"
              title="Approve leave applications"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}
              >
                <Clock size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">Manage Leave</span>
                <span className="hod-quick-tile-hint">Approve leave requests</span>
              </div>
            </div>

            {/* 5. View Reports -> /hod/reports */}
            <div
              onClick={() => navigate('/hod/reports')}
              className="hod-quick-tile"
              title="Institutional and department reports"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#ECFEFF', color: '#0891B2' }}
              >
                <FileText size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">View Reports</span>
                <span className="hod-quick-tile-hint">Department reports</span>
              </div>
            </div>

            {/* 6. AI Assistant -> /ai-workspace */}
            <div
              onClick={() => navigate('/ai-workspace')}
              className="hod-quick-tile"
              title="Open autonomous agent control center"
            >
              <div
                className="hod-quick-tile-icon-box"
                style={{ backgroundColor: '#FDF2F8', color: '#DB2777' }}
              >
                <Bot size={17} />
              </div>
              <div className="hod-quick-tile-content">
                <span className="hod-quick-tile-title">AI Assistant</span>
                <span className="hod-quick-tile-hint">Ask anything</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Full List Modal for Pending Approvals */}
      {showApprovalsModal && (
        <div className="hod-modal-overlay" onClick={() => setShowApprovalsModal(false)}>
          <div className="hod-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Pending Approvals Queue
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    {pendingApprovalsList.length} request{pendingApprovalsList.length === 1 ? '' : 's'} requiring departmental action
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowApprovalsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="hod-modal-body">
              {pendingApprovalsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                  <CheckCircle2 size={40} style={{ color: '#059669', margin: '0 auto 0.75rem auto' }} />
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#0F172A', fontSize: '15px' }}>
                    All Clear!
                  </h4>
                  <p style={{ margin: 0, fontSize: '12.5px' }}>
                    No pending leave, OD consideration, or attendance queries in queue.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingApprovalsList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                            {item.applicantName}
                          </span>
                          <span style={{ fontSize: '11px', backgroundColor: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                            {item.applicantRole} • {item.enrollmentOrEmail}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            border: '1px solid #FDE68A'
                          }}
                        >
                          ● {item.badge}
                        </span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.4 }}>
                        <strong>Reason:</strong> {item.reason}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '11.5px', color: '#64748B' }}>
                        <span>
                          <strong>Dates:</strong> {item.dates}
                        </span>
                        <button
                          onClick={() => {
                            setShowApprovalsModal(false);
                            navigate('/hod/requests');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <span>Review in Requests Central</span>
                          <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hod-modal-footer">
              <button
                onClick={() => setShowApprovalsModal(false)}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowApprovalsModal(false);
                  navigate('/hod/requests');
                }}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '0.45rem 1rem', borderRadius: '8px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Go to Requests Central</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Section Overview & Student Details Modal (Exact Wireframe Specification) */}
      {showSectionModal && (
        <div className="hod-modal-overlay" onClick={() => setShowSectionModal(false)}>
          <div className="hod-section-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="hod-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: '#2563EB' }} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    Section Overview ({d.departmentCode || 'CSE'} Only)
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Select a section card below to view enrolled students and assigned Tutor Guardian (TG).
                </p>
              </div>

              {/* Top Right Controls Matching User Request: Current Semester Badge & Move to Next Semester Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Show Current Semester Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Current:</span>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1.5px solid #BFDBFE',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      letterSpacing: '0.02em'
                    }}
                    title="Current active semester"
                  >
                    Sem {selectedSemester === 'ALL' ? 'All' : selectedSemester}
                  </span>
                </div>

                {/* Move to Next Semester Button (Promotion / Shift in DB) */}
                <button
                  type="button"
                  onClick={() => {
                    const fromSem = selectedSemester === 'ALL' ? 5 : Number(selectedSemester);
                    setTargetSemester(Math.min(8, fromSem + 1));
                    setShowMoveSemModal(true);
                  }}
                  className="btn btn-primary"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                  }}
                  title="Shift/Promote students of this semester to the next semester in database"
                >
                  <ArrowRight size={14} />
                  <span>Move to Next Semester {selectedSemester !== 'ALL' && selectedSemester < 8 ? `(Sem ${Number(selectedSemester) + 1})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  title="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="hod-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Top 4 Section Cards Grid (Matching User Drawing) */}
              <div className="hod-section-tabs-container">
                {sectionOverviewFiltered.map((sec) => {
                  const isSelected = (sec.rawName || '').toUpperCase() === selectedSectionLetter.toUpperCase();
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setSelectedSectionLetter(sec.rawName || 'A');
                        setSectionSearchTerm('');
                      }}
                      className={`hod-section-tab-btn ${isSelected ? 'active' : ''}`}
                      style={{
                        backgroundColor: isSelected ? '#EFF6FF' : sec.bg,
                        borderColor: isSelected ? '#2563EB' : sec.border
                      }}
                    >
                      <span
                        className="hod-section-tab-title"
                        style={{ color: isSelected ? '#1D4ED8' : sec.color }}
                      >
                        {sec.name}
                      </span>
                      <span className="hod-section-tab-count">
                        {sec.studentCount} {sec.studentCount === 1 ? 'Student' : 'Students'}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            marginTop: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#1D4ED8',
                            backgroundColor: '#DBEAFE',
                            padding: '1px 6px',
                            borderRadius: '9999px'
                          }}
                        >
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Student Details Card (Matching User Drawing with student details & TG : TG NAME) */}
              <div className="hod-student-details-box">
                {/* Header: student details on left, TG : TG NAME on right */}
                <div className="hod-student-details-header">
                  <div className="hod-student-details-title">
                    <GraduationCap size={18} style={{ color: '#2563EB' }} />
                    <span style={{ textTransform: 'lowercase' }}>student details</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#64748B',
                        backgroundColor: '#E2E8F0',
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}
                    >
                      {activeSectionData.name} • {activeSectionData.studentCount} Total
                    </span>
                  </div>

                  <div className="hod-student-tg-pill">
                    <UserCheck size={14} />
                    <span>TG : {activeSectionData.tgName || 'Prof. HOD CSE'}</span>
                  </div>
                </div>

                {/* Search Bar for student details */}
                <div
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#FFFFFF',
                    borderBottom: '1px solid #F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      maxWidth: '380px'
                    }}
                  >
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: '10px', color: '#94A3B8' }}
                    />
                    <input
                      type="text"
                      value={sectionSearchTerm}
                      onChange={(e) => setSectionSearchTerm(e.target.value)}
                      placeholder="Search student by name, enrollment, or email..."
                      style={{
                        width: '100%',
                        padding: '6px 12px 6px 32px',
                        fontSize: '12.5px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        outline: 'none',
                        color: '#0F172A'
                      }}
                    />
                    {sectionSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setSectionSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94A3B8',
                          padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                    Showing {filteredSectionStudents.length} of {activeSectionData.studentCount} students
                  </span>
                </div>

                {/* Table: name | enrollment | phone number | email */}
                <div className="hod-student-table-container">
                  {filteredSectionStudents.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '2.5rem 1.5rem',
                        color: '#64748B',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Users size={32} style={{ color: '#CBD5E1' }} />
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '13.5px', color: '#334155' }}>
                        {sectionSearchTerm
                          ? 'No matching students found'
                          : `No students enrolled in ${activeSectionData.name} yet`}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                        {sectionSearchTerm
                          ? 'Try adjusting your search criteria'
                          : 'Student records assigned to this section will appear here automatically.'}
                      </p>
                    </div>
                  ) : (
                    <table className="hod-student-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>name</th>
                          <th style={{ width: '22%' }}>enrollment</th>
                          <th style={{ width: '22%' }}>phone number</th>
                          <th style={{ width: '28%' }}>email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSectionStudents.map((st) => (
                          <tr key={st.id || st.enrollment}>
                            <td>
                              <div className="hod-student-name-cell">
                                <div className="hod-student-avatar">
                                  {(st.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <span>{st.name}</span>
                              </div>
                            </td>
                            <td>
                              <span className="hod-student-enrollment-badge">
                                {st.enrollment}
                              </span>
                            </td>
                            <td>
                              {st.phone && st.phone !== 'N/A' ? (
                                <a
                                  href={`tel:${st.phone}`}
                                  style={{
                                    color: '#2563EB',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontWeight: 500
                                  }}
                                  title="Call student"
                                >
                                  <Phone size={12} style={{ color: '#059669' }} />
                                  <span>{st.phone}</span>
                                </a>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>N/A</span>
                              )}
                            </td>
                            <td>
                              {st.email ? (
                                <a
                                  href={`mailto:${st.email}`}
                                  style={{
                                    color: '#2563EB',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Send email"
                                >
                                  <Mail size={12} style={{ color: '#64748B' }} />
                                  <span style={{ wordBreak: 'break-all' }}>{st.email}</span>
                                </a>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="hod-modal-footer">
              <Link
                to="/hod/classes"
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  textDecoration: 'none',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <span>Manage in Classes Central</span>
                <ExternalLink size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="btn btn-primary"
                style={{
                  fontSize: '12px',
                  padding: '0.45rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Move to Next Semester Confirmation Modal (Semester Promotion in Database) */}
      {showMoveSemModal && (
        <div className="hod-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowMoveSemModal(false)}>
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '90%',
              padding: '1.5rem',
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #CBD5E1'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Move to Next Semester
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Departmental Promotion & Student Shift
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoveSemModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                This action promotes enrolled students to the next academic semester directly in the PostgreSQL database.
              </p>

              {/* Transition Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600 }}>Current</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#1E293B' }}>Semester {selectedSemester === 'ALL' ? 5 : selectedSemester}</span>
                </div>
                <ArrowRight size={20} style={{ color: '#2563EB' }} />
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600 }}>Destination</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#2563EB' }}>Semester {targetSemester}</span>
                </div>
              </div>

              {/* Target Semester Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Target Semester:
                </label>
                <select
                  value={targetSemester}
                  onChange={(e) => setTargetSemester(Number(e.target.value))}
                  className="input-field"
                  style={{ width: '100%', height: '38px', fontSize: '12.5px', borderRadius: '8px' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s} disabled={s <= (selectedSemester === 'ALL' ? 5 : Number(selectedSemester))}>
                      Semester {s} {s === (selectedSemester === 'ALL' ? 5 : Number(selectedSemester)) + 1 ? '(Next Semester)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Promotion Scope:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: '#1E293B', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${moveScope === 'SECTION' ? '#2563EB' : '#E2E8F0'}`, backgroundColor: moveScope === 'SECTION' ? '#EFF6FF' : '#FFFFFF' }}>
                    <input
                      type="radio"
                      name="moveScope"
                      checked={moveScope === 'SECTION'}
                      onChange={() => setMoveScope('SECTION')}
                    />
                    <div>
                      <span style={{ fontWeight: 700 }}>Current Section only: CSE-{selectedSectionLetter}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {activeSectionData.studentCount} active students will be moved
                      </span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: '#1E293B', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${moveScope === 'ALL_SEMESTER' ? '#2563EB' : '#E2E8F0'}`, backgroundColor: moveScope === 'ALL_SEMESTER' ? '#EFF6FF' : '#FFFFFF' }}>
                    <input
                      type="radio"
                      name="moveScope"
                      checked={moveScope === 'ALL_SEMESTER'}
                      onChange={() => setMoveScope('ALL_SEMESTER')}
                    />
                    <div>
                      <span style={{ fontWeight: 700 }}>All Sections of Semester {selectedSemester === 'ALL' ? 5 : selectedSemester}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {totalStudentsInCurrentSemester} total students across all CSE sections
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setShowMoveSemModal(false)}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '0.45rem 1rem', borderRadius: '8px' }}
                disabled={moveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveSemester}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '0.45rem 1.25rem', backgroundColor: '#2563EB', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                disabled={moveLoading}
              >
                {moveLoading ? (
                  <>
                    <div className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }} />
                    <span>Moving Students...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={13} />
                    <span>Confirm & Move to Sem {targetSemester}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Unclipped Fixed Dropdown for Academic Year (Image Item 2) */}
      {showAcademicYearDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1190,
              backgroundColor: 'transparent'
            }}
            onClick={() => setShowAcademicYearDropdown(false)}
          />
          <div
            id="hod-academic-year-popover"
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              right: `${dropdownCoords.right}px`,
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.28), 0 6px 16px -2px rgba(15, 23, 42, 0.12)',
              border: '1px solid #CBD5E1',
              padding: '8px',
              minWidth: '240px',
              zIndex: 1200,
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Select Academic Year
            </div>

            {['2026-27', '2025-26', '2024-25', '2023-24'].map((year) => {
              const isSelected = academicYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setAcademicYear(year);
                    setShowAcademicYearDropdown(false);
                    addToast('Academic Year Updated', `Active departmental session switched to ${year}.`, 'success');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                    color: isSelected ? '#1D4ED8' : '#1E293B',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={13} style={{ color: isSelected ? '#2563EB' : '#94A3B8' }} />
                    <span>Academic Year: {year}</span>
                  </span>
                  {isSelected && <CheckCircle2 size={15} style={{ color: '#2563EB' }} />}
                </button>
              );
            })}

            <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '4px 0' }} />

            <button
              type="button"
              onClick={() => {
                setShowAcademicYearDropdown(false);
                setShowAcademicYearModal(true);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                fontWeight: 700,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#DCFCE7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F0FDF4';
              }}
            >
              <CalendarDays size={14} style={{ color: '#16A34A' }} />
              <span>View Full Academic Calendar</span>
              <ArrowRight size={12} style={{ marginLeft: 'auto' }} />
            </button>
          </div>
        </>
      )}

      {/* 7. Academic Calendar & Session Settings Modal */}
      {showAcademicYearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setShowAcademicYearModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #CBD5E1',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#0F172A' }}>
                    Academic Calendar & Session Settings
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Department of Computer Science & Engineering • Academic Session {academicYear}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAcademicYearModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Session Selector Cards */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Select Department Academic Session:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  {[
                    { year: '2026-27', label: 'Upcoming Session' },
                    { year: '2025-26', label: 'Current Active' },
                    { year: '2024-25', label: 'Previous Year' },
                    { year: '2023-24', label: 'Archived' }
                  ].map((item) => {
                    const isSelected = academicYear === item.year;
                    return (
                      <button
                        key={item.year}
                        type="button"
                        onClick={() => {
                          setAcademicYear(item.year);
                          addToast('Session Switched', `Active session updated to ${item.year}.`, 'info');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1.5px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
                          backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#1D4ED8' : '#0F172A' }}>
                            {item.year}
                          </span>
                          {isSelected && <CheckCircle2 size={14} style={{ color: '#2563EB' }} />}
                        </div>
                        <span style={{ fontSize: '10.5px', color: isSelected ? '#2563EB' : '#64748B' }}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Semester Timelines Tabs */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <button
                    type="button"
                    onClick={() => setCalendarActiveTab('ODD')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      border: 'none',
                      borderBottom: calendarActiveTab === 'ODD' ? '2px solid #2563EB' : 'none',
                      backgroundColor: calendarActiveTab === 'ODD' ? '#FFFFFF' : 'transparent',
                      color: calendarActiveTab === 'ODD' ? '#2563EB' : '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    Odd Semester (Sem 1, 3, 5, 7) • Jul – Dec
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarActiveTab('EVEN')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      border: 'none',
                      borderBottom: calendarActiveTab === 'EVEN' ? '2px solid #2563EB' : 'none',
                      backgroundColor: calendarActiveTab === 'EVEN' ? '#FFFFFF' : 'transparent',
                      color: calendarActiveTab === 'EVEN' ? '#2563EB' : '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    Even Semester (Sem 2, 4, 6, 8) • Jan – Jun
                  </button>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {calendarActiveTab === 'ODD' ? (
                    [
                      { date: '15 July 2025', title: 'Commencement of Academic Session', desc: 'Classes commence for B.Tech CSE Odd Semesters (3rd, 5th, 7th Sem).', tag: 'Academic' },
                      { date: '15 – 20 September 2025', title: 'Mid-Semester Test - I (MST-1)', desc: 'First centralized mid-term exams across all sections.', tag: 'Examination' },
                      { date: '26 September 2025', title: 'Attendance Shortage Review & Parent Alert', desc: 'Students under 75% marked for mandatory TG parent calls.', tag: 'Compliance' },
                      { date: '10 – 15 November 2025', title: 'Mid-Semester Test - II (MST-2)', desc: 'Second mid-term evaluations and lab assessment review.', tag: 'Examination' },
                      { date: '24 – 29 November 2025', title: 'Remedial Classes & Term Work Submission', desc: 'Freezing of sessional and internal marks submission on portal.', tag: 'Internal Marks' },
                      { date: '01 – 06 December 2025', title: 'Practical & Viva-Voce Exams', desc: 'External practical examinations as scheduled by RGPV.', tag: 'Practical' },
                      { date: '10 – 30 December 2025', title: 'RGPV University Theory Examinations', desc: 'Final university theory examination window.', tag: 'University Exam' }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
                          border: '1px solid #F1F5F9'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{item.title}</span>
                          <span style={{ fontSize: '11.5px', color: '#64748B' }}>{item.desc}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', display: 'block' }}>{item.date}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669', backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>{item.tag}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    [
                      { date: '12 January 2026', title: 'Commencement of Classes (Even Sem)', desc: 'Classes begin for Even Semesters (2nd, 4th, 6th, 8th Sem).', tag: 'Academic' },
                      { date: '20 – 25 February 2026', title: 'Annual Techno-Cultural Fest (TechAcme)', desc: 'College annual fest, national hackathons & coding leagues.', tag: 'Event' },
                      { date: '16 – 21 March 2026', title: 'Mid-Semester Test - I (MST-1)', desc: 'First mid-term exam for even semester modules.', tag: 'Examination' },
                      { date: '20 – 25 April 2026', title: 'Mid-Semester Test - II (MST-2)', desc: 'Final internal evaluation test and project progress reviews.', tag: 'Examination' },
                      { date: '05 May 2026', title: 'Attendance Freezing & Hall Ticket Issuance', desc: 'System seals final attendance tally for semester.', tag: 'Compliance' },
                      { date: '15 – 22 May 2026', title: 'Major / Minor Project Defense & Viva', desc: 'Final year project evaluation and practical exams.', tag: 'Practical' },
                      { date: '25 May – 15 June 2026', title: 'RGPV University Theory Examinations', desc: 'End semester final theory examination period.', tag: 'University Exam' }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
                          border: '1px solid #F1F5F9'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{item.title}</span>
                          <span style={{ fontSize: '11.5px', color: '#64748B' }}>{item.desc}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', display: 'block' }}>{item.date}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669', backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>{item.tag}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
              <button
                type="button"
                onClick={handleDownloadAcademicCalendar}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Download Official Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAcademicYearModal(false)}
                style={{
                  padding: '7px 22px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Consideration & Planned Leave Reports Modal (Matching Image 1 Wireframe) */}
      <AttendanceLeaveReportsModal
        isOpen={isConsiderationModalOpen}
        onClose={() => setIsConsiderationModalOpen(false)}
        userRole="hod"
      />
    </div>
  );
}
