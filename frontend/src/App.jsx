import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { ERPProvider, useERP } from './context/ERPContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import StudentRegisterPage from './pages/auth/StudentRegisterPage';
import TeacherRegisterPage from './pages/auth/TeacherRegisterPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentRequests from './pages/student/StudentRequests';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentAssignments from './pages/student/StudentAssignments';
import StudentNotices from './pages/student/StudentNotices';
import StudentProfile from './pages/student/StudentProfile';

// TG Pages
import TgDashboard from './pages/tg/TgDashboard';
import TgMyStudents from './pages/tg/TgMyStudents';
import TgRequests from './pages/tg/TgRequests';
import TgNotices from './pages/tg/TgNotices';

// HOD Pages
import HodDashboard from './pages/hod/HodDashboard';
import HodAttendanceApproval from './pages/hod/HodAttendanceApproval';
import HodLeaveApproval from './pages/hod/HodLeaveApproval';
import HodRequestsCentral from './pages/hod/HodRequestsCentral';
import HodTeacherManagement from './pages/hod/HodTeacherManagement';
import HodClassesSections from './pages/hod/HodClassesSections';
import HodStudents from './pages/hod/HodStudents';
import HodTimetableGenerator from './pages/hod/HodTimetableGenerator';
import HodTimetableMonitoring from './pages/hod/HodTimetableMonitoring';
import HodNotices from './pages/hod/HodNotices';
import HodReports from './pages/hod/HodReports';

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherMarkAttendance from './pages/teacher/TeacherMarkAttendance';
import TeacherLectures from './pages/teacher/TeacherLectures';
import TeacherAssignments from './pages/teacher/TeacherAssignments';
import TeacherTests from './pages/teacher/TeacherTests';
import TeacherStudents from './pages/teacher/TeacherStudents';
import TeacherClasses from './pages/teacher/TeacherClasses';
import TeacherTimetable from './pages/teacher/TeacherTimetable';
import TeacherNotices from './pages/teacher/TeacherNotices';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminStudents from './pages/admin/AdminStudents';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminSettings from './pages/admin/AdminSettings';
import MasterDataManagement from './pages/admin/MasterDataManagement';
import AIWorkspace from './pages/ai/AIWorkspace';

// Icons
import { ShieldAlert, ArrowLeft } from 'lucide-react';

function RoleRedirect() {
  const { currentRole, isAuthenticated, loadingAuth } = useERP();

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
        <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading ERP Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${currentRole}`} replace />;
}

function ProtectedLayout() {
  const { isAuthenticated, loadingAuth } = useERP();
  const location = useLocation();

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
        <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Authenticating Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <DashboardLayout />;
}

function LoginWrapper() {
  const { isAuthenticated, currentRole, loadingAuth } = useERP();
  if (loadingAuth) return null;
  if (isAuthenticated) {
    return <Navigate to={`/${currentRole}`} replace />;
  }
  return <LoginPage />;
}

function RoleRouteGuard({ role, children }) {
  const { currentRole, currentUser, isAuthenticated, loadingAuth } = useERP();
  const location = useLocation();

  if (loadingAuth) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if current user is officially appointed as TG
  const isAppointedTg = Boolean(
    currentRole === 'tg' ||
    currentUser?.isTG ||
    currentUser?.isTg ||
    (currentUser?.mentorGroups && currentUser?.mentorGroups.length > 0) ||
    (currentUser?.designation || '').toLowerCase().includes('(tg)')
  );

  if (!role) {
    return children;
  }

  let isMatch = false;

  if (Array.isArray(role)) {
    isMatch = role.some((r) => {
      if (r === currentRole) return true;
      if (r === 'teacher') return currentRole === 'teacher' || currentRole === 'faculty' || (currentRole === 'tg' && isAppointedTg);
      if (r === 'hod') return currentRole === 'hod';
      if (r === 'tg') return isAppointedTg;
      return false;
    });
  } else if (role === currentRole) {
    // If route requires TG, ensure teacher is actually appointed as TG
    if (role === 'tg') {
      isMatch = isAppointedTg;
    } else {
      isMatch = true;
    }
  } else if (role === 'teacher') {
    // TG teachers are also faculty members who teach classes
    isMatch = currentRole === 'teacher' || currentRole === 'faculty' || (currentRole === 'tg' && isAppointedTg);
  } else if (role === 'tg') {
    // Only teachers appointed as TG can access TG pages
    isMatch = isAppointedTg && (currentRole === 'teacher' || currentRole === 'faculty' || currentRole === 'tg');
  }

  if (!isMatch) {
    // If a normal faculty tries to access TG views, route them to their normal faculty dashboard
    if (role === 'tg' && (currentRole === 'teacher' || currentRole === 'faculty')) {
      return <Navigate to="/teacher" replace />;
    }

    return (
      <div className="page-wrapper" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card text-center" style={{ maxWidth: '480px', padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Access Restricted (403 Forbidden)
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.5, margin: 0 }}>
            You do not have permission to access this resource. Your authenticated role is <strong>{currentRole.toUpperCase()}</strong>.
          </p>
          <Link
            to={`/${currentRole}`}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            <span>Return to My Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <ERPProvider>
      <Routes>
        {/* Public Authentication & Registration Routes */}
        <Route path="/login" element={<LoginWrapper />} />
        <Route path="/register/student" element={<StudentRegisterPage />} />
        <Route path="/register/teacher" element={<Navigate to="/login?role=faculty" replace />} />

        {/* Protected ERP Dashboard Layout */}
        <Route path="/" element={<ProtectedLayout />}>
          {/* Default Route redirects to active role */}
          <Route index element={<RoleRedirect />} />

          {/* Unified AI Workspace (renders inside shared DashboardLayout) */}
          <Route path="ai-workspace" element={<AIWorkspace />} />

          {/* Student Routes */}
          <Route path="student" element={<RoleRouteGuard role="student"><StudentDashboard /></RoleRouteGuard>} />
          <Route path="student/attendance" element={<RoleRouteGuard role="student"><StudentAttendance /></RoleRouteGuard>} />
          <Route path="student/timetable" element={<RoleRouteGuard role="student"><StudentTimetable /></RoleRouteGuard>} />
          <Route path="student/assignments" element={<RoleRouteGuard role="student"><StudentAssignments /></RoleRouteGuard>} />
          <Route path="student/requests" element={<RoleRouteGuard role="student"><StudentRequests /></RoleRouteGuard>} />
          <Route path="student/notices" element={<RoleRouteGuard role="student"><StudentNotices /></RoleRouteGuard>} />
          <Route path="student/profile" element={<RoleRouteGuard role="student"><StudentProfile /></RoleRouteGuard>} />

          {/* TG / Mentor Routes */}
          <Route path="tg" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgDashboard /></RoleRouteGuard>} />
          <Route path="tg/dashboard" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgDashboard /></RoleRouteGuard>} />
          <Route path="tg/students" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgMyStudents /></RoleRouteGuard>} />
          <Route path="tg/requests" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgRequests /></RoleRouteGuard>} />
          <Route path="tg/attendance" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgRequests /></RoleRouteGuard>} />
          <Route path="tg/leave" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgRequests /></RoleRouteGuard>} />
          <Route path="tg/notices" element={<RoleRouteGuard role={['tg', 'teacher', 'faculty', 'hod', 'admin']}><TgNotices /></RoleRouteGuard>} />

          {/* HOD Routes */}
          <Route path="hod" element={<RoleRouteGuard role="hod"><HodDashboard /></RoleRouteGuard>} />
          <Route path="hod/dashboard" element={<RoleRouteGuard role="hod"><HodDashboard /></RoleRouteGuard>} />
          <Route path="hod/teachers" element={<RoleRouteGuard role="hod"><HodTeacherManagement /></RoleRouteGuard>} />
          <Route path="hod/classes" element={<RoleRouteGuard role="hod"><HodClassesSections /></RoleRouteGuard>} />
          <Route path="hod/students" element={<RoleRouteGuard role="hod"><HodStudents /></RoleRouteGuard>} />
          <Route path="hod/requests" element={<RoleRouteGuard role="hod"><HodRequestsCentral /></RoleRouteGuard>} />
          <Route path="hod/approvals" element={<RoleRouteGuard role="hod"><HodAttendanceApproval /></RoleRouteGuard>} />
          <Route path="hod/attendance" element={<RoleRouteGuard role="hod"><HodAttendanceApproval /></RoleRouteGuard>} />
          <Route path="hod/leave" element={<RoleRouteGuard role="hod"><HodLeaveApproval /></RoleRouteGuard>} />
          <Route path="hod/timetable" element={<RoleRouteGuard role="hod"><HodTimetableGenerator /></RoleRouteGuard>} />
          <Route path="hod/monitoring" element={<RoleRouteGuard role="hod"><HodTimetableMonitoring /></RoleRouteGuard>} />
          <Route path="hod/notices" element={<RoleRouteGuard role="hod"><HodNotices /></RoleRouteGuard>} />
          <Route path="hod/reports" element={<RoleRouteGuard role="hod"><HodReports /></RoleRouteGuard>} />
          <Route path="hod/master-data" element={<RoleRouteGuard role="hod"><MasterDataManagement /></RoleRouteGuard>} />
          <Route path="hod/lectures" element={<RoleRouteGuard role="hod"><TeacherLectures /></RoleRouteGuard>} />
          <Route path="lectures" element={<RoleRouteGuard role={['hod', 'teacher', 'faculty']}><TeacherLectures /></RoleRouteGuard>} />

          {/* Teacher Routes */}
          <Route path="teacher" element={<RoleRouteGuard role="teacher"><TeacherDashboard /></RoleRouteGuard>} />
          <Route path="teacher/attendance" element={<RoleRouteGuard role="teacher"><TeacherMarkAttendance /></RoleRouteGuard>} />
          <Route path="teacher/lectures" element={<RoleRouteGuard role="teacher"><TeacherLectures /></RoleRouteGuard>} />
          <Route path="teacher/assignments" element={<RoleRouteGuard role="teacher"><TeacherAssignments /></RoleRouteGuard>} />
          <Route path="teacher/tests" element={<RoleRouteGuard role="teacher"><TeacherTests /></RoleRouteGuard>} />
          <Route path="teacher/students" element={<RoleRouteGuard role="teacher"><TeacherStudents /></RoleRouteGuard>} />
          <Route path="teacher/classes" element={<RoleRouteGuard role="teacher"><TeacherClasses /></RoleRouteGuard>} />
          <Route path="teacher/timetable" element={<RoleRouteGuard role="teacher"><TeacherTimetable /></RoleRouteGuard>} />
          <Route path="teacher/notices" element={<RoleRouteGuard role="teacher"><TeacherNotices /></RoleRouteGuard>} />

          {/* Admin Routes */}
          <Route path="admin" element={<RoleRouteGuard role="admin"><AdminDashboard /></RoleRouteGuard>} />
          <Route path="admin/users" element={<RoleRouteGuard role="admin"><AdminUsers /></RoleRouteGuard>} />
          <Route path="admin/students" element={<RoleRouteGuard role="admin"><AdminStudents /></RoleRouteGuard>} />
          <Route path="admin/teachers" element={<RoleRouteGuard role="admin"><AdminTeachers /></RoleRouteGuard>} />
          <Route path="admin/departments" element={<RoleRouteGuard role="admin"><AdminDepartments /></RoleRouteGuard>} />
          <Route path="admin/structure" element={<RoleRouteGuard role="admin"><AdminDepartments /></RoleRouteGuard>} />
          <Route path="admin/master-data" element={<RoleRouteGuard role="admin"><MasterDataManagement /></RoleRouteGuard>} />
          <Route path="admin/timetable" element={<RoleRouteGuard role="admin"><HodTimetableGenerator /></RoleRouteGuard>} />
          <Route path="admin/notices" element={<RoleRouteGuard role="admin"><HodNotices /></RoleRouteGuard>} />
          <Route path="admin/settings" element={<RoleRouteGuard role="admin"><AdminSettings /></RoleRouteGuard>} />

          {/* Catch-all redirect */}
          <Route path="*" element={<RoleRedirect />} />
        </Route>
      </Routes>
    </ERPProvider>
  );
}
