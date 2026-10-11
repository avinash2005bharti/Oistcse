import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  Calendar,
  Plus,
  UploadCloud,
  Download,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Check,
  RefreshCw,
  UserCheck,
  Eye,
  FileText,
  Sparkles
} from 'lucide-react';
import { masterDataApi } from '../../api/masterDataApi';
import { classroomApi } from '../../api/classroomApi';
import { academicApi } from '../../api/academicApi';
import { useERP } from '../../context/ERPContext';
import ImportSampleFormatViewer from '../../components/common/ImportSampleFormatViewer';
import { downloadSampleCsvFile } from '../../utils/importSampleFormats';

export default function MasterDataManagement() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const urlAction = searchParams.get('action');
  const { currentRole } = useERP();
  const [activeTab, setActiveTab] = useState(urlTab || 'teachers'); // teachers | students | subjects | classrooms | timetables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [timetables, setTimetables] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(Boolean(urlAction));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Import state
  const [importModalView, setImportModalView] = useState(urlAction === 'sample' ? 'sample' : 'upload'); // 'upload' | 'sample'
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { totalRows, validCount, invalidCount, preview, errors }

  // Form state
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
    if (urlAction === 'import') {
      setImportModalView('upload');
      setIsImportModalOpen(true);
    } else if (urlAction === 'sample') {
      setImportModalView('sample');
      setIsImportModalOpen(true);
    }
  }, [urlTab, urlAction]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'teachers') {
        const res = await masterDataApi.getTeachers();
        setTeachers(res?.data || res || []);
      } else if (activeTab === 'students') {
        const res = await masterDataApi.getStudents();
        setStudents(res?.data || res || []);
      } else if (activeTab === 'subjects') {
        const res = await masterDataApi.getSubjects();
        setSubjects(res?.data || res || []);
      } else if (activeTab === 'classrooms') {
        const res = await masterDataApi.getClassrooms();
        setClassrooms(res?.data || res || []);
      } else if (activeTab === 'timetables') {
        const res = await masterDataApi.getTimetables();
        setTimetables(res?.data || res || []);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch master data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setSuccessMsg(`Exporting ${activeTab}...`);
      await masterDataApi.exportData(activeTab);
      setSuccessMsg(`Successfully exported ${activeTab}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err?.message || 'Failed to export Excel');
    }
  };

  // Preview file for bulk import
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setError(null);
    try {
      const res = await masterDataApi.previewImport(activeTab, importFile);
      setImportPreview(res?.data || res);
    } catch (err) {
      setError(err?.message || 'Failed to parse import file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.validRecords || importPreview.validRecords.length === 0) return;
    setImportLoading(true);
    setError(null);
    try {
      const res = await masterDataApi.confirmImport(activeTab, importPreview.validRecords);
      setSuccessMsg(res?.message || `Successfully imported ${res?.inserted || importPreview.validRecords.length} records!`);
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview(null);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err?.message || 'Failed to confirm import');
    } finally {
      setImportLoading(false);
    }
  };

  // Delete item
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      if (activeTab === 'teachers') await masterDataApi.deleteTeacher(id);
      else if (activeTab === 'students') await masterDataApi.deleteStudent(id);
      else if (activeTab === 'subjects') await masterDataApi.deleteSubject(id);
      else if (activeTab === 'classrooms') await masterDataApi.deleteClassroom(id);
      else if (activeTab === 'timetables') await masterDataApi.deleteTimetable(id);
      setSuccessMsg('Record deleted successfully');
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to delete record');
    }
  };

  // Add Item Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'teachers') {
        await masterDataApi.createTeacher(formData);
      } else if (activeTab === 'students') {
        await masterDataApi.createStudent(formData);
      } else if (activeTab === 'subjects') {
        await masterDataApi.createSubject(formData);
      } else if (activeTab === 'classrooms') {
        await masterDataApi.createClassroom(formData);
      }
      setSuccessMsg('Record created successfully!');
      setIsAddModalOpen(false);
      setFormData({});
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to create record');
    }
  };

  // Edit Item Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'teachers') {
        await masterDataApi.updateTeacher(selectedItem.id, formData);
      } else if (activeTab === 'students') {
        await masterDataApi.updateStudent(selectedItem.id, formData);
      } else if (activeTab === 'classrooms') {
        await masterDataApi.updateClassroom(selectedItem.id, formData);
      }
      setSuccessMsg('Record updated successfully!');
      setIsEditModalOpen(false);
      setSelectedItem(null);
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to update record');
    }
  };

  // Filtered lists
  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchQ = (t.name || '').toLowerCase().includes(q) ||
                   (t.employeeId || '').toLowerCase().includes(q) ||
                   (t.email || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchQ && matchStatus;
  });

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchQ = (s.name || '').toLowerCase().includes(q) ||
                   (s.enrollmentNo || s.rollNumber || '').toLowerCase().includes(q) ||
                   (s.email || '').toLowerCase().includes(q);
    return matchQ;
  });

  const filteredSubjects = subjects.filter((sb) => {
    const q = searchQuery.toLowerCase();
    return (sb.name || '').toLowerCase().includes(q) || (sb.code || '').toLowerCase().includes(q);
  });

  const filteredClassrooms = classrooms.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (c.roomNumber || '').toLowerCase().includes(q) || (c.roomType || '').toLowerCase().includes(q);
  });

  const filteredTimetables = timetables.filter((tt) => {
    const q = searchQuery.toLowerCase();
    return (tt.section?.name || '').toLowerCase().includes(q) ||
           String(tt.semester || '').includes(q) ||
           (tt.status || '').toLowerCase().includes(q);
  });

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Master Data & Bulk Import Management
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>
            Central repository for Teachers, Students, Subjects, Classrooms, and Timetables with Excel/CSV bulk import
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            onClick={() => { setFormData({}); setIsAddModalOpen(true); }}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px' }}
          >
            <Plus size={16} />
            <span>Add {activeTab.slice(0, -1)}</span>
          </button>

          <button
            onClick={() => { setImportFile(null); setImportPreview(null); setImportModalView('upload'); setIsImportModalOpen(true); }}
            className="btn btn-outline-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px', background: '#F8FAFC' }}
            id="btn-open-bulk-import"
          >
            <UploadCloud size={16} />
            <span>Import Excel/CSV</span>
          </button>

          <button
            onClick={() => { setImportModalView('sample'); setIsImportModalOpen(true); }}
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE'
            }}
            id="btn-open-sample-format"
            title="View spreadsheet format specifications and download templates"
          >
            <Eye size={16} />
            <span>View Sample Format</span>
          </button>

          <button
            onClick={handleExport}
            className="btn btn-outline-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF' }}
          >
            <Download size={16} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Data"
            className="btn btn-light"
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
          >
            <RefreshCw size={16} className={loading ? 'fa-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4" style={{ borderRadius: '8px', padding: '12px 16px' }}>
          <div className="d-flex align-items-center gap-2">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4" style={{ borderRadius: '8px', padding: '12px 16px' }}>
          <div className="d-flex align-items-center gap-2">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 mb-4 border-bottom pb-2" style={{ borderColor: '#E2E8F0' }}>
        {[
          { id: 'teachers', label: 'Faculty & Teachers', icon: <UserCheck size={18} />, count: teachers.length },
          { id: 'students', label: 'Student Roster', icon: <GraduationCap size={18} />, count: students.length },
          { id: 'subjects', label: 'Course Subjects', icon: <BookOpen size={18} />, count: subjects.length },
          { id: 'classrooms', label: 'Classrooms & Labs', icon: <Building2 size={18} />, count: classrooms.length },
          { id: 'timetables', label: 'Timetable Records', icon: <Calendar size={18} />, count: timetables.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: activeTab === tab.id ? '#3B82F6' : '#F1F5F9',
              color: activeTab === tab.id ? '#FFFFFF' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                color: activeTab === tab.id ? '#FFFFFF' : '#64748B'
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 mb-4" style={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-6">
            <div className="input-group" style={{ borderRadius: '8px', overflow: 'hidden' }}>
              <span className="input-group-text bg-white border-end-0 text-muted">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder={`Search ${activeTab} by name, ID, code, email...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '14px' }}
              />
            </div>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '14px', borderRadius: '8px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
          <div className="col-md-3 text-end text-muted" style={{ fontSize: '13px' }}>
            Showing {
              activeTab === 'teachers' ? filteredTeachers.length :
              activeTab === 'students' ? filteredStudents.length :
              activeTab === 'subjects' ? filteredSubjects.length :
              activeTab === 'classrooms' ? filteredClassrooms.length :
              filteredTimetables.length
            } records
          </div>
        </div>
      </div>

      {/* Active Tab Data Table */}
      <div className="card" style={{ borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div className="table-responsive">
          {activeTab === 'teachers' && (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Teacher</th>
                  <th>Employee ID</th>
                  <th>Email & Phone</th>
                  <th>Department & Designation</th>
                  <th>Max Workload</th>
                  <th>Status</th>
                  <th className="text-end" style={{ paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">No faculty records found</td></tr>
                ) : (
                  filteredTeachers.map((t) => (
                    <tr key={t.id}>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="fw-bold text-dark">{t.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>User: {t.user?.email || t.email}</div>
                      </td>
                      <td><span className="badge bg-light text-dark border">{t.employeeId || 'N/A'}</span></td>
                      <td>
                        <div>{t.email || t.user?.email || 'N/A'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{t.phone || '-'}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{t.department?.name || 'Computer Science & Engineering'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{t.designation || 'Assistant Professor'}</div>
                      </td>
                      <td><span className="badge bg-primary-subtle text-primary">{t.maxWeeklyWorkload || 18} hrs/wk</span></td>
                      <td>
                        <span className={`badge ${t.status === 'ACTIVE' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                          {t.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="text-end" style={{ paddingRight: '16px' }}>
                        <button
                          onClick={() => { setSelectedItem(t); setFormData(t); setIsEditModalOpen(true); }}
                          className="btn btn-sm btn-light me-1"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'students' && (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th>Enrollment / Roll No</th>
                  <th>Semester & Section</th>
                  <th>Department</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th className="text-end" style={{ paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">No student records found</td></tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="fw-bold text-dark">{s.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>User: {s.user?.email || s.email}</div>
                      </td>
                      <td><span className="badge bg-light text-dark border">{s.enrollmentNo || s.rollNumber || 'N/A'}</span></td>
                      <td>
                        <span className="badge bg-info-subtle text-info fw-bold">Sem {s.semester || 5} - {s.section?.name || s.section || 'A'}</span>
                      </td>
                      <td>{s.department?.name || 'Computer Science & Engineering'}</td>
                      <td>
                        <div>{s.email || s.user?.email || 'N/A'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{s.phone || '-'}</div>
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'ACTIVE' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                          {s.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="text-end" style={{ paddingRight: '16px' }}>
                        <button
                          onClick={() => { setSelectedItem(s); setFormData(s); setIsEditModalOpen(true); }}
                          className="btn btn-sm btn-light me-1"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'subjects' && (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Subject Name</th>
                  <th>Subject Code</th>
                  <th>Type</th>
                  <th>Semester</th>
                  <th>Weekly Periods</th>
                  <th>Assigned Faculty</th>
                  <th>Lab Required</th>
                  <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-5 text-muted">No course subjects found</td></tr>
                ) : (
                  filteredSubjects.map((sb) => (
                    <tr key={sb.id}>
                      <td style={{ padding: '12px 16px' }} className="fw-bold text-dark">{sb.name}</td>
                      <td><span className="badge bg-secondary-subtle text-secondary fw-semibold">{sb.code}</span></td>
                      <td>
                        <span className={`badge ${sb.type === 'PRACTICAL' || sb.type === 'LAB' ? 'bg-warning-subtle text-warning' : 'bg-primary-subtle text-primary'}`}>
                          {sb.type || 'THEORY'}
                        </span>
                      </td>
                      <td>Semester {sb.semester || 5}</td>
                      <td><span className="badge bg-light text-dark border">{sb.weeklySlots || sb.weeklyPeriods || 4} slots/wk</span></td>
                      <td>{sb.faculty?.name || sb.teacher?.name || 'Unassigned'}</td>
                      <td>
                        {sb.requiresLab || sb.type === 'PRACTICAL' || sb.type === 'LAB' ? (
                          <span className="badge bg-info-subtle text-info">Yes (Lab)</span>
                        ) : (
                          <span className="badge bg-light text-muted">No (Classroom)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(sb.id)}
                          style={{ padding: '4px 8px', borderRadius: '6px' }}
                          title={`Delete ${sb.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'classrooms' && (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Room Number</th>
                  <th>Room Type</th>
                  <th>Capacity</th>
                  <th>Availability</th>
                  <th>Department</th>
                  <th className="text-end" style={{ paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClassrooms.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-5 text-muted">No classrooms or labs found</td></tr>
                ) : (
                  filteredClassrooms.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: '12px 16px' }} className="fw-bold text-dark">{c.roomNumber}</td>
                      <td>
                        <span className={`badge ${c.roomType === 'LAB' ? 'bg-warning-subtle text-warning' : 'bg-info-subtle text-info'}`}>
                          {c.roomType || 'CLASSROOM'}
                        </span>
                      </td>
                      <td>{c.capacity || 60} Students</td>
                      <td>
                        <span className={`badge ${c.status === 'AVAILABLE' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                          {c.status || 'AVAILABLE'}
                        </span>
                      </td>
                      <td>{c.department?.name || 'Computer Science & Engineering'}</td>
                      <td className="text-end" style={{ paddingRight: '16px' }}>
                        <button
                          onClick={() => { setSelectedItem(c); setFormData(c); setIsEditModalOpen(true); }}
                          className="btn btn-sm btn-light me-1"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'timetables' && (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Timetable Target</th>
                  <th>Semester & Section</th>
                  <th>Version</th>
                  <th>Total Class Slots</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th className="text-end" style={{ paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimetables.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">No timetable records saved</td></tr>
                ) : (
                  filteredTimetables.map((tt) => (
                    <tr key={tt.id}>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="fw-bold text-dark">{tt.department?.name || 'Computer Science & Engineering'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>ID: {tt.id}</div>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary fw-bold">
                          Sem {tt.semester} - Section {tt.section?.name || 'A'}
                        </span>
                      </td>
                      <td><span className="badge bg-light text-dark border">v{tt.version || 1}</span></td>
                      <td><span className="fw-semibold">{tt.slots?.length || 0} Slots</span></td>
                      <td>
                        <span className={`badge ${tt.status === 'PUBLISHED' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                          {tt.status || 'DRAFT'}
                        </span>
                      </td>
                      <td>{new Date(tt.createdAt).toLocaleDateString()}</td>
                      <td className="text-end" style={{ paddingRight: '16px' }}>
                        <button
                          onClick={() => handleDelete(tt.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete Timetable"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- BULK IMPORT MODAL WITH DRY-RUN PREVIEW (FLOATING POPUP) --- */}
      {isImportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: importModalView === 'sample' ? '960px' : '820px',
              width: '100%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              transition: 'max-width 0.25s ease'
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
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Bulk Import {activeTab.toUpperCase()}
                  </h5>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Upload Excel (.xlsx) or CSV spreadsheet to validate and import records
                  </span>
                </div>
              </div>

              {/* Header Right Actions (Matches User Sketch) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setImportModalView(importModalView === 'sample' ? 'upload' : 'sample')}
                  className="btn btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: importModalView === 'sample' ? '#EEF2FF' : '#F1F5F9',
                    color: importModalView === 'sample' ? '#4F46E5' : '#334155',
                    border: importModalView === 'sample' ? '1.5px solid #6366F1' : '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: importModalView === 'sample' ? '0 1px 3px rgba(99, 102, 241, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  id="btn-sample-data-format-header"
                  title="View required column headers, accepted aliases, rules and sample records"
                >
                  <Eye size={14} color={importModalView === 'sample' ? '#4F46E5' : '#475569'} />
                  <span>{importModalView === 'sample' ? 'Back to File Upload' : 'View Sample Data Format'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* In-Modal Segmented View Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 1.5rem',
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #F1F5F9'
              }}
            >
              <button
                type="button"
                onClick={() => setImportModalView('upload')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: importModalView === 'upload' ? 700 : 500,
                  color: importModalView === 'upload' ? '#2563EB' : '#64748B',
                  backgroundColor: importModalView === 'upload' ? '#EFF6FF' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <UploadCloud size={14} />
                <span>Upload & Validate File</span>
              </button>

              <button
                type="button"
                onClick={() => setImportModalView('sample')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: importModalView === 'sample' ? 700 : 500,
                  color: importModalView === 'sample' ? '#4F46E5' : '#64748B',
                  backgroundColor: importModalView === 'sample' ? '#EEF2FF' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={14} />
                <span>View Sample Data Format & Template</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {importModalView === 'sample' ? (
                <ImportSampleFormatViewer
                  currentType={activeTab}
                  onSelectType={(newType) => setActiveTab(newType)}
                  onBackToUpload={() => setImportModalView('upload')}
                />
              ) : (
                <>
                  {/* Step 1: Upload File */}
                  <div
                    className="mb-4 text-center p-4 border border-2 border-dashed rounded-3"
                    style={{ backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }}
                  >
                    <UploadCloud size={42} style={{ color: '#2563EB', margin: '0 auto 8px auto' }} />
                    <h6 style={{ fontWeight: 700, color: '#0F172A' }}>Choose Excel (.xlsx) or CSV file to import</h6>
                    <p className="text-muted small mb-3">Ensure your spreadsheet contains headers matching the required fields</p>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      className="form-control"
                      style={{ maxWidth: '420px', margin: '0 auto' }}
                    />
                    {importFile && (
                      <div className="mt-3">
                        <span className="badge me-2" style={{ backgroundColor: '#2563EB', color: '#FFFFFF', padding: '6px 12px' }}>Selected: {importFile.name}</span>
                        <button
                          onClick={handlePreviewImport}
                          disabled={importLoading}
                          className="btn btn-sm btn-primary"
                          style={{ fontWeight: 600, padding: '5px 14px' }}
                        >
                          {importLoading ? 'Validating...' : 'Preview & Validate'}
                        </button>
                      </div>
                    )}

                    {/* Helper Prompt to View Sample Format or Download Template */}
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px dashed #CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Unsure about spreadsheet columns?</span>
                      <button
                        type="button"
                        onClick={() => setImportModalView('sample')}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#2563EB',
                          fontWeight: 700,
                          fontSize: '12px',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        View Sample Data Format
                      </button>
                      <span style={{ color: '#CBD5E1' }}>•</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await masterDataApi.downloadSampleTemplate(activeTab, 'xlsx');
                          } catch (e) {
                            downloadSampleCsvFile(activeTab);
                          }
                        }}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#059669',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <Download size={13} />
                        Download Excel Template (.xlsx)
                      </button>
                      <span style={{ color: '#CBD5E1' }}>•</span>
                      <button
                        type="button"
                        onClick={() => downloadSampleCsvFile(activeTab)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#0284C7',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <Download size={13} />
                        Download .CSV
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Dry Run Validation Results */}
                  {importPreview && (
                    <div>
                      <div className="d-flex gap-3 mb-3">
                        <div className="card p-3 flex-fill text-center border-success bg-success-subtle">
                          <div style={{ fontSize: '20px', fontWeight: 800 }}>{importPreview.validCount || 0}</div>
                          <div style={{ fontSize: '12px' }}>Valid Records</div>
                        </div>
                        <div className="card p-3 flex-fill text-center border-danger bg-danger-subtle">
                          <div style={{ fontSize: '20px', fontWeight: 800 }}>{importPreview.invalidCount || 0}</div>
                          <div style={{ fontSize: '12px' }}>Duplicates / Errors</div>
                        </div>
                        <div className="card p-3 flex-fill text-center border-secondary bg-light">
                          <div style={{ fontSize: '20px', fontWeight: 800 }}>{importPreview.totalRows || 0}</div>
                          <div style={{ fontSize: '12px' }}>Total Rows Read</div>
                        </div>
                      </div>

                      {/* Validation Errors List */}
                      {importPreview.errors && importPreview.errors.length > 0 && (
                        <div className="alert alert-warning mb-3" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                          <div className="fw-bold mb-1">Validation Warnings / Detected Duplicates:</div>
                          <ul className="mb-0 ps-3 small">
                            {importPreview.errors.map((err, i) => (
                              <li key={i}>{typeof err === 'string' ? err : `Row ${err.row}: ${err.error}`}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Preview Table */}
                      {importPreview.preview && importPreview.preview.length > 0 && (
                        <div className="table-responsive border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table className="table table-sm table-striped mb-0 small">
                            <thead>
                              <tr>
                                {Object.keys(importPreview.preview[0] || {}).slice(0, 5).map((col) => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.preview.slice(0, 5).map((row, idx) => (
                                <tr key={idx}>
                                  {Object.values(row).slice(0, 5).map((v, cIdx) => (
                                    <td key={cIdx}>{String(v)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsImportModalOpen(false)}
                style={{ fontSize: '12px', padding: '0.45rem 1rem' }}
              >
                Close
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {importModalView === 'sample' ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setImportModalView('upload')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      fontSize: '12px',
                      padding: '0.45rem 1.25rem'
                    }}
                  >
                    <UploadCloud size={16} />
                    <span>Upload & Import Records</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleConfirmImport}
                    disabled={!importPreview || importLoading || !importPreview.validCount}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      fontSize: '12px',
                      padding: '0.45rem 1.25rem',
                      backgroundColor: '#059669',
                      borderColor: '#059669'
                    }}
                  >
                    <Check size={16} />
                    <span>Confirm & Import {importPreview?.validCount || 0} Records</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD MODAL (FLOATING POPUP) --- */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '560px',
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
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Add New {activeTab.slice(0, -1).toUpperCase()}
                </h5>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {activeTab === 'teachers' && (
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Full Name *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Employee ID *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.employeeId || ''}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Email Address *</label>
                      <input
                        type="email"
                        required
                        className="form-control"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Designation</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Assistant Professor"
                        value={formData.designation || ''}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Max Weekly Workload (Hours)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.maxWeeklyWorkload || 18}
                        onChange={(e) => setFormData({ ...formData, maxWeeklyWorkload: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'students' && (
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Student Name *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Enrollment / Roll Number *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.enrollmentNo || formData.rollNumber || ''}
                        onChange={(e) => setFormData({ ...formData, enrollmentNo: e.target.value, rollNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Email Address *</label>
                      <input
                        type="email"
                        required
                        className="form-control"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-bold">Semester</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.semester || 5}
                          onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value, 10) })}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold">Section</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="A, B, or C"
                          value={formData.section || 'A'}
                          onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'subjects' && (
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Subject Name *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Subject Code *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="e.g. CS501"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-bold">Type</label>
                        <select
                          className="form-select"
                          value={formData.type || 'THEORY'}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                          <option value="THEORY">Theory</option>
                          <option value="PRACTICAL">Practical</option>
                          <option value="LAB">Lab</option>
                          <option value="TUTORIAL">Tutorial</option>
                          <option value="ELECTIVE">Elective</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold">Semester</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.semester || 5}
                          onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value, 10) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Weekly Slots / Hours</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.weeklySlots || 4}
                        onChange={(e) => setFormData({ ...formData, weeklySlots: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'classrooms' && (
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Room Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CR-301 or Lab-3"
                        className="form-control"
                        value={formData.roomNumber || ''}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Room Type</label>
                      <select
                        className="form-select"
                        value={formData.roomType || 'CLASSROOM'}
                        onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                      >
                        <option value="CLASSROOM">Classroom</option>
                        <option value="LAB">Computer Lab</option>
                        <option value="SEMINAR_HALL">Seminar Hall</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Seating Capacity</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.capacity || 60}
                        onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fw-bold">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL (FLOATING POPUP) --- */}
      {isEditModalOpen && selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '1.25rem'
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleEditSubmit}>
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
                <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Edit {activeTab.slice(0, -1).toUpperCase()}
                </h5>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div>
                  <label className="form-label small fw-bold">Name / Title</label>
                  <input
                    type="text"
                    className="form-control mb-3"
                    value={formData.name || formData.roomNumber || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, roomNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label small fw-bold">Status</label>
                  <select
                    className="form-select mb-3"
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="AVAILABLE">AVAILABLE</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fw-bold">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
