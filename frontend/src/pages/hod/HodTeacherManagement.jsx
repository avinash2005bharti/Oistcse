import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { teacherApi } from '../../api/teacherApi';
import { teacherSchedulerApi } from '../../api/teacherSchedulerApi';
import { leaveApi } from '../../api/leaveApi';
import {
  UserCheck,
  BookOpen,
  Clock,
  Calendar,
  Search,
  ShieldCheck,
  Bot,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Plus,
  Users,
  Award,
  GraduationCap,
  Shield,
  Edit3,
  X
} from 'lucide-react';

export default function HodTeacherManagement() {
  const { addToast, sections } = useERP();
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'tg' | 'regular'

  // TG Appointment Modal & State
  const [showTgModal, setShowTgModal] = useState(false);
  const [tgTeacher, setTgTeacher] = useState(null);
  const [tgSectionId, setTgSectionId] = useState('');
  const [tgSemester, setTgSemester] = useState(5);
  const [tgSectionLetter, setTgSectionLetter] = useState('A');
  const [tgAcademicYear, setTgAcademicYear] = useState('2026-27');
  const [appointingTg, setAppointingTg] = useState(false);

  // AI Absence Scheduler Modal & State
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [absenceDate, setAbsenceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [absenceReason, setAbsenceReason] = useState('Personal / Medical Leave');
  const [analyzing, setAnalyzing] = useState(false);
  const [proposalData, setProposalData] = useState(null);
  const [applying, setApplying] = useState(false);

  // Add Faculty Modal State & Handler
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingFaculty, setSubmittingFaculty] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmpId, setNewFacultyEmpId] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyDesignation, setNewFacultyDesignation] = useState('Assistant Professor');
  const [newFacultyPhone, setNewFacultyPhone] = useState('');
  const [newFacultySpecialization, setNewFacultySpecialization] = useState('Computer Science & Engineering');
  const [newFacultyIsTg, setNewFacultyIsTg] = useState(false);
  const [newFacultyMaxPerDay, setNewFacultyMaxPerDay] = useState(4);
  const [newFacultyMaxPerWeek, setNewFacultyMaxPerWeek] = useState(18);

  // Edit Faculty Modal State (HOD: No Password Field)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    employeeId: '',
    email: '',
    designation: 'Assistant Professor',
    specialization: 'Computer Science & Engineering',
    phone: '',
    isTG: false,
    status: 'ACTIVE',
    maxPeriodsPerDay: 4,
    maxPeriodsPerWeek: 18
  });

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!newFacultyName.trim() || !newFacultyEmail.trim()) {
      addToast('Validation Error', 'Name and official email are required.', 'warning');
      return;
    }

    setSubmittingFaculty(true);
    try {
      await teacherApi.createFaculty({
        name: newFacultyName.trim(),
        employeeId: newFacultyEmpId.trim() ? newFacultyEmpId.trim().toUpperCase() : undefined,
        email: newFacultyEmail.trim().toLowerCase(),
        designation: newFacultyDesignation,
        specialization: newFacultySpecialization.trim() || 'Computer Science & Engineering',
        phone: newFacultyPhone.trim() || undefined,
        isTG: Boolean(newFacultyIsTg),
        maxPeriodsPerDay: parseInt(newFacultyMaxPerDay, 10) || 4,
        maxPeriodsPerWeek: parseInt(newFacultyMaxPerWeek, 10) || 18
      });

      addToast('Faculty Registered', `${newFacultyName} (${newFacultyDesignation}) account provisioned successfully.`, 'success');
      setIsAddModalOpen(false);
      setNewFacultyName('');
      setNewFacultyEmpId('');
      setNewFacultyEmail('');
      setNewFacultyPhone('');
      setNewFacultySpecialization('Computer Science & Engineering');
      setNewFacultyIsTg(false);
      setNewFacultyMaxPerDay(4);
      setNewFacultyMaxPerWeek(18);

      fetchFaculty();
    } catch (err) {
      addToast('Error Adding Faculty', err.message || 'Unable to register faculty member.', 'error');
    } finally {
      setSubmittingFaculty(false);
    }
  };

  const handleOpenEditFaculty = (fac) => {
    setEditingFaculty(fac);
    const fullName = fac.name || `${fac.firstName || ''} ${fac.lastName || ''}`.trim();
    setEditForm({
      id: fac.id,
      name: fullName,
      employeeId: fac.employeeId || fac.employee_id || '',
      email: fac.email || '',
      designation: fac.designation || 'Assistant Professor',
      specialization: fac.specialization || 'Computer Science & Engineering',
      phone: fac.phone || '',
      isTG: Boolean(fac.isTG || fac.isTg),
      status: fac.status || 'ACTIVE',
      maxPeriodsPerDay: fac.max_periods_per_day || fac.maxPeriodsPerDay || 4,
      maxPeriodsPerWeek: fac.max_periods_per_week || fac.maxPeriodsPerWeek || 18
    });
    setIsEditModalOpen(true);
  };

  const handleEditFacultySubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.email.trim()) {
      addToast('Validation Error', 'Name and official email are required.', 'warning');
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        employeeId: editForm.employeeId.trim() ? editForm.employeeId.trim().toUpperCase() : undefined,
        employee_id: editForm.employeeId.trim() ? editForm.employeeId.trim().toUpperCase() : undefined,
        designation: editForm.designation,
        specialization: editForm.specialization.trim() || 'Computer Science & Engineering',
        phone: editForm.phone.trim() || undefined,
        isTG: Boolean(editForm.isTG),
        status: editForm.status,
        maxPeriodsPerDay: parseInt(editForm.maxPeriodsPerDay, 10) || 4,
        maxPeriodsPerWeek: parseInt(editForm.maxPeriodsPerWeek, 10) || 18
      };

      await teacherApi.updateFaculty(editForm.id, payload);
      addToast('Faculty Updated', `${editForm.name} profile successfully updated.`, 'success');
      setIsEditModalOpen(false);
      setEditingFaculty(null);
      fetchFaculty();
    } catch (err) {
      addToast('Update Failed', err.message || 'Unable to update faculty profile.', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchFaculty = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await teacherApi.getFaculty();
      if (res?.faculty) {
        setFacultyList(res.faculty);
        if (res.faculty.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(res.faculty[0].id);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load faculty records from database.');
    } finally {
      setLoading(false);
    }
  };

  const [togglingId, setTogglingId] = useState(null);

  const handleToggleFacultyLeave = async (faculty) => {
    try {
      setTogglingId(faculty.id);
      const isCurrentlyOnLeave = faculty.availability_status === 'On Leave' || faculty.status === 'ON_LEAVE';
      const nextStatus = !isCurrentlyOnLeave;

      await leaveApi.toggleLeave(faculty.id, {
        onLeave: nextStatus,
        reason: nextStatus ? 'Marked on leave by HOD' : ''
      });

      setFacultyList((prev) =>
        prev.map((f) => {
          if (f.id === faculty.id) {
            return {
              ...f,
              status: nextStatus ? 'ON_LEAVE' : 'ACTIVE',
              availability_status: nextStatus ? 'On Leave' : 'Available'
            };
          }
          return f;
        })
      );

      addToast(
        nextStatus ? 'Faculty Marked On Leave' : 'Faculty Marked Available',
        `${faculty.name} is now ${nextStatus ? 'ON LEAVE 🔴' : 'AVAILABLE 🟢'} for today.`,
        nextStatus ? 'warning' : 'success'
      );
    } catch (err) {
      addToast('Error Toggling Leave', err.message || 'Unable to update status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  // Filtered faculty based on search and active tab
  const filteredFaculty = facultyList.filter((f) => {
    const term = search.toLowerCase();
    const matchesSearch =
      f.name?.toLowerCase().includes(term) ||
      f.specialization?.toLowerCase().includes(term) ||
      f.email?.toLowerCase().includes(term) ||
      f.designation?.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (activeTab === 'tg') {
      return f.isTG;
    } else if (activeTab === 'regular') {
      return !f.isTG;
    }
    return true;
  });

  // KPI Metrics
  const totalFacultyCount = facultyList.length;
  const tgCount = facultyList.filter((f) => f.isTG).length;
  const regularCount = facultyList.filter((f) => !f.isTG).length;
  const assignedSections = [...new Set(facultyList.filter((f) => f.isTG && f.tgSection).map((f) => f.tgSection))];
  const selectedTgSection = sections.find((section) => section.id === tgSectionId);

  // Open TG Appointment Modal
  const handleOpenTgModal = (faculty = null) => {
    const target = faculty || (facultyList.length > 0 ? facultyList[0] : null);
    setTgTeacher(target);
    const currentSection = sections.find((section) =>
      section.id === target?.tgSectionId ||
      (section.name === target?.tgSection && (!target?.tgSemester || section.semester === target.tgSemester))
    );
    const resolvedSection = currentSection || sections[0];
    const initialSem = resolvedSection?.semester || 5;
    const initialSec = resolvedSection?.name || 'A';
    setTgSemester(initialSem);
    setTgSectionLetter(initialSec);
    setTgSectionId(resolvedSection?.id || '');
    setTgAcademicYear(resolvedSection?.academicYear || '2026-27');
    setShowTgModal(true);
  };

  // Submit TG Appointment
  const handleAppointTgSubmit = async (e) => {
    e.preventDefault();
    if (!tgTeacher) return;

    const targetSection = selectedTgSection || sections.find(
      (s) => Number(s.semester) === Number(tgSemester) && s.name === tgSectionLetter
    ) || {
      id: tgSectionId || 'sec-auto',
      name: tgSectionLetter,
      semester: tgSemester,
      academicYear: tgAcademicYear
    };

    setAppointingTg(true);

    try {
      const res = await teacherApi.appointTg(tgTeacher.id, {
        sectionId: targetSection.id,
        section: targetSection.name || tgSectionLetter,
        semester: targetSection.semester || tgSemester,
        academicYear: tgAcademicYear
      });

      addToast(
        'TG Appointed Successfully',
        res.message || `${tgTeacher.name} has been appointed as Tutor Guardian for Semester ${targetSection.semester || tgSemester}, Section ${targetSection.name || tgSectionLetter}.`,
        'success'
      );
      setShowTgModal(false);
      setTgTeacher(null);
      await fetchFaculty();
    } catch (err) {
      addToast('Appointment Failed', err.message || 'Failed to appoint teacher as TG.', 'error');
    } finally {
      setAppointingTg(false);
    }
  };

  // Revoke TG Appointment
  const handleRevokeTg = async (faculty) => {
    if (!window.confirm(`Are you sure you want to revoke Tutor Guardian (TG) status for ${faculty.name}?`)) {
      return;
    }

    try {
      const res = await teacherApi.revokeTg(faculty.id);
      addToast(
        'TG Appointment Revoked',
        res.message || `Tutor Guardian appointment removed for ${faculty.name}.`,
        'info'
      );
      await fetchFaculty();
    } catch (err) {
      addToast('Revocation Failed', err.message || 'Could not revoke TG role.', 'error');
    }
  };

  // Analyze Absence & Generate Substitutions
  const handleAnalyzeAbsence = async (e) => {
    e.preventDefault();
    setAnalyzing(true);
    setProposalData(null);

    const faculty = facultyList.find((f) => String(f.id) === String(selectedTeacherId));
    if (!faculty) {
      addToast('Teacher Required', 'Please select an absent teacher.', 'warning');
      setAnalyzing(false);
      return;
    }

    try {
      const dayName = new Date(absenceDate).toLocaleDateString('en-US', { weekday: 'long' });
      const res = await teacherSchedulerApi.analyzeAbsence({
        teacher_name: faculty.name,
        date: absenceDate,
        day: dayName,
        department: faculty.department_code || 'CSE'
      });

      setProposalData(res);
      addToast('AI Analysis Complete', `Identified ${res.affected_count || res.proposals?.length || 0} affected classes.`, 'info');
    } catch (err) {
      addToast('Analysis Failed', err.message || 'Error analyzing absence.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply substitutions to relational database
  const handleApplySubstitutions = async () => {
    if (!proposalData) return;
    setApplying(true);

    try {
      await teacherSchedulerApi.applySubstitutions({
        absence_data: proposalData,
        approved_by: 'HOD CSE'
      });

      addToast('Substitutions Applied', 'Timetable entries updated and notifications dispatched.', 'success');
      setShowAbsenceModal(false);
      setProposalData(null);
      fetchFaculty();
    } catch (err) {
      addToast('Application Failed', err.message || 'Failed to apply substitutions.', 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
              <span className="badge badge-indigo text-xs">HOD Portal</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Institutional Hierarchy</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Faculty & Tutor Guardian (TG) Management
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Department of Computer Science & Engineering • Relational Workload & Mentorship Allocations
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary text-xs py-2 px-3.5 shadow-sm flex items-center gap-1.5 font-bold"
              id="btn-add-faculty"
            >
              <Plus size={15} />
              <span>+ Add Faculty Member</span>
            </button>

            <button
              onClick={() => handleOpenTgModal()}
              className="btn btn-primary text-xs py-2 px-3.5 shadow-sm flex items-center gap-1.5"
              id="btn-appoint-tg"
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
            >
              <ShieldCheck size={16} />
              <span>Appoint Tutor Guardian (TG)</span>
            </button>

            <button
              onClick={() => setShowAbsenceModal(true)}
              className="btn btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5"
              id="btn-report-absence"
            >
              <Bot size={15} />
              <span>Absence & AI Adjust</span>
            </button>

            <button
              onClick={fetchFaculty}
              disabled={loading}
              className="btn btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Department Faculty
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {totalFacultyCount} Members
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '4px solid #10B981' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Appointed Tutor Guardians (TG)
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {tgCount} Active TGs
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={22} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mentored Sections
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {assignedSections.length > 0 ? assignedSections.map((s) => `Sec ${s}`).join(', ') : 'Sec A, B'}
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={22} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HOD Clearance Gateway
              </span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                Multi-Tier Active
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="p-8 text-center text-slate-500 card flex flex-col items-center justify-center gap-2">
            <div className="spinner-border text-primary" role="status" style={{ width: '2rem', height: '2rem' }} />
            <span className="text-xs font-semibold">Loading Department Faculty Records from Database...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchFaculty} className="btn btn-sm btn-primary text-xs">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Filter Tabs and Search */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `All Faculty (${totalFacultyCount})` },
                    { id: 'tg', label: `🛡️ Tutor Guardians (${tgCount})` },
                    { id: 'regular', label: `Standard Faculty (${regularCount})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`btn text-xs py-1.5 px-3.5 rounded-full ${activeTab === tab.id ? 'btn-primary font-bold' : 'btn-outline text-slate-600'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '280px', flex: 1, maxWidth: '420px' }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search faculty by name, email, or designation..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field"
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Faculty List Grid */}
            {filteredFaculty.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs card">
                No matching faculty records found.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '1rem' }}>
                {filteredFaculty.map((fac) => (
                  <div
                    key={fac.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft: fac.isTG ? '4px solid #10B981' : '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Header info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {fac.name}
                        </h3>
                        <span style={{ fontSize: '12px', color: fac.isTG ? '#059669' : 'var(--primary)', fontWeight: 700 }}>
                          {fac.designation}
                        </span>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {fac.email} {fac.phone ? `• ${fac.phone}` : ''}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleFacultyLeave(fac)}
                          disabled={togglingId === fac.id}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: togglingId === fac.id ? 'not-allowed' : 'pointer',
                            border: (fac.availability_status === 'On Leave' || fac.status === 'ON_LEAVE')
                              ? '1px solid #10B981'
                              : '1px solid #EF4444',
                            backgroundColor: (fac.availability_status === 'On Leave' || fac.status === 'ON_LEAVE')
                              ? '#ECFDF5'
                              : '#FEF2F2',
                            color: (fac.availability_status === 'On Leave' || fac.status === 'ON_LEAVE')
                              ? '#065F46'
                              : '#991B1B',
                            transition: 'all 0.2s ease'
                          }}
                          title="Click to toggle faculty leave status for today"
                        >
                          <span>
                            {(fac.availability_status === 'On Leave' || fac.status === 'ON_LEAVE')
                              ? '🔴 On Leave (Click to Clear)'
                              : '🟢 Available (Click for Leave)'}
                          </span>
                          {togglingId === fac.id && <RefreshCw size={10} className="animate-spin" />}
                        </button>
                        {fac.isTG && (
                          <span
                            className="badge badge-emerald"
                            style={{ fontSize: '10px', fontWeight: 700, padding: '0.2rem 0.5rem' }}
                          >
                            TG • {fac.tgSection || 'Section unassigned'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specialization */}
                    <div style={{ backgroundColor: 'var(--surface-low)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-lg)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                        Specialization
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {fac.specialization}
                      </span>
                    </div>

                    {/* Workload stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '12px' }}>
                      <div style={{ backgroundColor: 'var(--surface-low)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Periods / Day</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {fac.max_periods_per_day || 4} slots
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--surface-low)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Periods / Week</span>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {fac.max_periods_per_week || 18} slots
                        </div>
                      </div>
                    </div>

                    {/* TG Status & Appointment Actions (HOD Feature) */}
                    <div
                      style={{
                        marginTop: '0.25rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      {fac.isTG ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            className="badge badge-emerald"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.65rem',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            <ShieldCheck size={14} />
                            <span>Designated TG ({fac.tgSection || 'Section unassigned'})</span>
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Regular Faculty Member
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditFaculty(fac)}
                          className="btn btn-outline text-xs py-1.5 px-2.5 flex items-center gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                          title="Edit faculty member profile"
                        >
                          <Edit3 size={12} className="text-blue-600" />
                          <span>Edit</span>
                        </button>

                        {fac.isTG ? (
                          <>
                            <button
                              onClick={() => handleOpenTgModal(fac)}
                              className="btn btn-outline text-xs py-1.5 px-2.5 flex items-center gap-1"
                              title="Reassign or edit TG Section"
                            >
                              <span>Change Section</span>
                            </button>
                            <button
                              onClick={() => handleRevokeTg(fac)}
                              className="btn text-xs py-1.5 px-2.5 flex items-center gap-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                              title="Revoke TG Appointment"
                            >
                              <span>Revoke TG</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleOpenTgModal(fac)}
                            className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                            title="Appoint this teacher as Tutor Guardian"
                          >
                            <UserCheck size={14} />
                            <span>Appoint as TG</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Appoint as Tutor Guardian (TG) Modal */}
      {showTgModal && tgTeacher && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Appoint Tutor Guardian (TG)
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    HOD Departmental Governance & Mentorship Assignment
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTgModal(false);
                  setTgTeacher(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Teacher Details */}
            <div style={{ backgroundColor: 'var(--surface-low)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Selected Faculty Member
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {tgTeacher.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {tgTeacher.designation} • {tgTeacher.email}
              </div>
            </div>

            {/* Target Teacher Selector if changing */}
            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Faculty Member *
              </label>
              <select
                value={tgTeacher.id}
                onChange={(e) => {
                  const f = facultyList.find((item) => String(item.id) === String(e.target.value));
                  if (f) setTgTeacher(f);
                }}
                className="input-field"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.designation})
                  </option>
                ))}
              </select>
            </div>

            {/* Section & Year Selection */}
            <form onSubmit={handleAppointTgSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                    Select Semester *
                  </label>
                  <select
                    value={tgSemester}
                    onChange={(e) => {
                      const newSem = Number(e.target.value);
                      setTgSemester(newSem);
                      const matching = sections.find((s) => Number(s.semester) === newSem && s.name === tgSectionLetter) ||
                        sections.find((s) => Number(s.semester) === newSem);
                      if (matching) {
                        setTgSectionId(matching.id);
                        setTgSectionLetter(matching.name);
                        setTgAcademicYear(matching.academicYear || tgAcademicYear);
                      }
                    }}
                    className="input-field"
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                    Select Section *
                  </label>
                  <select
                    value={tgSectionLetter}
                    onChange={(e) => {
                      const newLetter = e.target.value;
                      setTgSectionLetter(newLetter);
                      const matching = sections.find((s) => Number(s.semester) === Number(tgSemester) && s.name === newLetter);
                      if (matching) {
                        setTgSectionId(matching.id);
                        setTgAcademicYear(matching.academicYear || tgAcademicYear);
                      }
                    }}
                    className="input-field"
                    required
                  >
                    {['A', 'B', 'C', 'D'].map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '-0.35rem' }}>
                All students in Semester {tgSemester}, Section {tgSectionLetter} will report directly to this Tutor Guardian.
              </span>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Academic Session
                </label>
                <input
                  type="text"
                  value={tgAcademicYear}
                  onChange={(e) => setTgAcademicYear(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Responsibilities Note */}
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  fontSize: '11.5px',
                  color: '#166534',
                  lineHeight: 1.45
                }}
              >
                <strong>TG Powers & Mentorship Scope:</strong>
                <ul style={{ margin: '4px 0 0 1rem', padding: 0 }}>
                  <li>First-tier review & approval for student leave requests</li>
                  <li>Monitoring individual attendance and issuing 75% shortage alerts</li>
                  <li>Direct TG portal login credentials enabled with mentee roster</li>
                </ul>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTgModal(false);
                    setTgTeacher(null);
                  }}
                  className="btn btn-outline text-xs py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appointingTg}
                  className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  {appointingTg ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Appointing TG...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>Confirm TG Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Absence & Substitution Modal (Section 17) */}
      {showAbsenceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={22} className="text-blue-600" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Teacher Absence & AI Substitution Scheduler
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAbsenceModal(false);
                  setProposalData(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAnalyzeAbsence} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Select Absent Faculty Member *
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="input-field"
                  required
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                    Absence Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={absenceDate}
                    onChange={(e) => setAbsenceDate(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                    Reason
                  </label>
                  <input
                    type="text"
                    value={absenceReason}
                    onChange={(e) => setAbsenceReason(e.target.value)}
                    className="input-field"
                    placeholder="Medical / Official Duty"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={analyzing}
                className="btn btn-primary"
                style={{ padding: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Sparkles size={16} />
                <span>{analyzing ? 'Analyzing Timetable Slots via AI...' : 'Generate Adjustment via AI'}</span>
              </button>
            </form>

            {/* AI Proposal Results Display */}
            {proposalData && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    AI Substitution Schedule Proposals ({proposalData.proposals?.length || 0})
                  </h4>
                  <span className="badge badge-emerald text-xs">Ready for Approval</span>
                </div>

                {proposalData.proposals?.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748B' }}>
                    No lectures scheduled for this teacher on this day.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {proposalData.proposals.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{p.subject} • {p.class_info}</span>
                          <span className="text-blue-600">{p.time}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Original: <strong>{proposalData.absent_teacher}</strong></span>
                          <span>Room: <strong>{p.room}</strong></span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between mt-1">
                          <span>Recommended Substitute: <strong>{p.proposed_substitute}</strong></span>
                          <span className="text-[10px] text-emerald-700">{p.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {proposalData.proposals?.length > 0 && (
                  <button
                    onClick={handleApplySubstitutions}
                    disabled={applying}
                    className="btn btn-success"
                    style={{ width: '100%', padding: '0.85rem', fontWeight: 700 }}
                  >
                    {applying ? 'Applying Transactional Substitutions...' : 'Approve & Apply Substitutions to Timetable'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Faculty Member Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', padding: '1rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', maxWidth: '520px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-subtle)', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Register Faculty Member
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Create new teacher account and profile in PostgreSQL
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn-icon"
                title="Close"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '12.5px' }}>
              <div>
                <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Full Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Official Email <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={newFacultyEmail}
                    onChange={(e) => setNewFacultyEmail(e.target.value)}
                    placeholder="e.g. rajesh@college.edu"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={newFacultyEmpId}
                    onChange={(e) => setNewFacultyEmpId(e.target.value)}
                    placeholder="Auto or EMP-101"
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Designation
                  </label>
                  <select
                    className="input-field"
                    value={newFacultyDesignation}
                    onChange={(e) => setNewFacultyDesignation(e.target.value)}
                  >
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Professor">Professor</option>
                    <option value="Visiting Faculty">Visiting Faculty</option>
                    <option value="Lab Instructor">Lab Instructor</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={newFacultyPhone}
                    onChange={(e) => setNewFacultyPhone(e.target.value)}
                    placeholder="+91..."
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Specialization / Domain
                </label>
                <input
                  type="text"
                  value={newFacultySpecialization}
                  onChange={(e) => setNewFacultySpecialization(e.target.value)}
                  placeholder="e.g. AI & Machine Learning, Data Structures"
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Max Periods / Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={newFacultyMaxPerDay}
                    onChange={(e) => setNewFacultyMaxPerDay(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Max Periods / Week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="35"
                    value={newFacultyMaxPerWeek}
                    onChange={(e) => setNewFacultyMaxPerWeek(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  id="hod-new-faculty-is-tg"
                  checked={newFacultyIsTg}
                  onChange={(e) => setNewFacultyIsTg(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="hod-new-faculty-is-tg" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Appoint as Tutor Guardian (TG) for Department
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFaculty}
                  className="btn btn-primary"
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  {submittingFaculty ? 'Registering...' : 'Register Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal for HOD (No Password Field Allowed) */}
      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Edit Faculty Profile
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Department Record Update for {editingFaculty?.employeeId || editingFaculty?.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="btn-icon"
                title="Close"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditFacultySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '12.5px' }}>
              <div>
                <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={editForm.employeeId}
                    onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                    placeholder="EMP-HOD-01"
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="faculty@college.edu"
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91..."
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    placeholder="Professor & Head"
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={editForm.specialization}
                    onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                    placeholder="Computer Science"
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  id="hod-edit-faculty-is-tg"
                  checked={editForm.isTG}
                  onChange={(e) => setEditForm({ ...editForm, isTG: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="hod-edit-faculty-is-tg" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Designated Tutor Guardian (TG) for Department
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="btn btn-primary"
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
