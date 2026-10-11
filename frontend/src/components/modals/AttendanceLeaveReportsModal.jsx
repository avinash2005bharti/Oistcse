import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { requestApi } from '../../api/requestApi';
import { useERP } from '../../context/ERPContext';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import {
  parseRecordForLedger,
  exportLedgerToExcel,
  exportLedgerToCSV,
  printLedgerReport
} from '../../utils/reportExportUtils';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Check
} from 'lucide-react';

export default function AttendanceLeaveReportsModal({
  isOpen,
  onClose,
  initialTab = 'attendance',
  initialSemester = 'ALL',
  initialSection = 'ALL',
  userRole = 'all'
}) {
  const { addToast, currentUser } = useERP();

  const [activeTab, setActiveTab] = useState(initialTab || 'attendance'); // 'attendance' | 'leaves'
  const [selectedSemester, setSelectedSemester] = useState(initialSemester);
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [considerationList, setConsiderationList] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
  const [showExportSemesterModal, setShowExportSemesterModal] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState(null); // 'excel' | 'csv' | 'print'
  const [exportTargetSemester, setExportTargetSemester] = useState('ALL');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    setSelectedSemester(initialSemester);
    setSelectedSection(initialSection);
  }, [initialTab, initialSemester, initialSection]);

  const fetchReports = async () => {
    setLoading(true);
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
      console.warn('[AttendanceLeaveReportsModal] Error fetching requests:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, selectedSemester, selectedSection]);

  const filteredConsiderations = useMemo(() => {
    return considerationList.filter((item) => {
      const semMatches = selectedSemester === 'ALL' || String(item.semester) === String(selectedSemester);
      const secVal = typeof item.section === 'object' && item.section !== null ? item.section.name : (item.section || 'A');
      const secMatches = selectedSection === 'ALL' || secVal.toUpperCase() === selectedSection.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const queryMatches =
        !q ||
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.enrollmentNo || item.rollNo || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q);
      return semMatches && secMatches && queryMatches;
    });
  }, [considerationList, selectedSemester, selectedSection, searchQuery]);

  const filteredLeaves = useMemo(() => {
    return leaveList.filter((item) => {
      const semMatches = selectedSemester === 'ALL' || String(item.semester) === String(selectedSemester);
      const secVal = typeof item.section === 'object' && item.section !== null ? item.section.name : (item.section || 'A');
      const secMatches = selectedSection === 'ALL' || secVal.toUpperCase() === selectedSection.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const queryMatches =
        !q ||
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.enrollmentNo || item.rollNo || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q);
      return semMatches && secMatches && queryMatches;
    });
  }, [leaveList, selectedSemester, selectedSection, searchQuery]);

  const currentRecords = activeTab === 'attendance' ? filteredConsiderations : filteredLeaves;
  const currentCategoryLabel =
    activeTab === 'attendance'
      ? 'Official Approved Attendance Considerations & Sanctioned OD Ledger'
      : 'Official Approved Student Leave Applications Ledger';

  const authorizedByTitle =
    userRole === 'hod' || currentUser?.role === 'hod'
      ? 'Head of Department (HOD CSE)'
      : userRole === 'tg' || currentUser?.role === 'tg'
        ? `Tutor Guardian (${currentUser?.name || 'CSE Mentor'})`
        : 'Head of Department (HOD CSE)';

  // Helper to trigger specific export with semester
  const executeExport = (format, sem = selectedSemester) => {
    let dataset = activeTab === 'attendance' ? considerationList : leaveList;
    if (sem !== 'ALL') {
      dataset = dataset.filter((r) => String(r.semester) === String(sem));
    }

    if (!dataset || dataset.length === 0) {
      addToast?.('No Records', `There are no records to export for Semester ${sem}.`, 'warning');
      return;
    }

    const semLabel = sem === 'ALL' ? 'All Semesters' : `Semester ${sem}`;

    if (format === 'excel') {
      exportLedgerToExcel({
        records: dataset,
        semester: sem,
        authorizedBy: authorizedByTitle,
        categoryLabel: currentCategoryLabel
      });
      addToast?.('Excel Export Ready', `Downloaded ${dataset.length} records for ${semLabel}.`, 'success');
    } else if (format === 'csv') {
      exportLedgerToCSV({
        records: dataset,
        semester: sem
      });
      addToast?.('CSV Export Complete', `Exported ${dataset.length} records for ${semLabel} as CSV.`, 'success');
    } else if (format === 'print') {
      printLedgerReport({
        records: dataset,
        semester: sem,
        authorizedBy: authorizedByTitle,
        categoryLabel: currentCategoryLabel
      });
      addToast?.('Print Report Opened', `Prepared PDF print ledger for ${semLabel}.`, 'info');
    }
  };

  const handleActionClick = (format) => {
    setPendingExportFormat(format);
    setExportTargetSemester(selectedSemester);
    setShowExportSemesterModal(true);
  };

  const handleConfirmSemesterExport = () => {
    if (pendingExportFormat) {
      executeExport(pendingExportFormat, exportTargetSemester);
    }
    setShowExportSemesterModal(false);
  };

  if (!isOpen) return null;

  const modalNode = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          maxWidth: '1200px',
          width: '98%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          margin: 'auto',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            1. MODAL HEADER WITH OFFICIAL LOGO & 4 SYSTEM ACTIONS
            [google live sheet] | [export excel] | [csv] | [print report]
            ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 2rem',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(29, 78, 216, 0.08)'
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: '#ECFDF5',
                    color: '#065F46',
                    border: '1px solid #A7F3D0'
                  }}
                >
                  CampusFlow ERP
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>
                Department of Computer Science & Engineering &bull; Official Clearances & Sanctioned Requests Ledger
              </p>
            </div>
          </div>

          {/* Top 4 System Actions (Matching Diagram Flow) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* 1. Google Live Sheet */}
            <button
              type="button"
              id="btn-ledger-google-live-sheet"
              onClick={() => setShowGoogleSheetModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Stream & synchronize approved clearances with Google Live Sheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>google live sheet</span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#059669',
                  boxShadow: '0 0 0 2px #A7F3D0',
                  display: 'inline-block'
                }}
              />
            </button>

            {/* 2. Export Excel */}
            <button
              type="button"
              id="btn-ledger-export-excel"
              onClick={() => handleActionClick('excel')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Download formatted Excel workbook (.xls) with full two-tier table layout"
            >
              <FileSpreadsheet size={14} />
              <span>export excel</span>
            </button>

            {/* 3. CSV */}
            <button
              type="button"
              id="btn-ledger-export-csv"
              onClick={() => handleActionClick('csv')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#F8FAFC',
                color: '#334155',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Download RFC-compliant CSV report"
            >
              <Download size={14} />
              <span>csv</span>
            </button>

            {/* 4. Print Report / PDF */}
            <button
              type="button"
              id="btn-ledger-print-report"
              onClick={() => handleActionClick('print')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Open Printable / PDF Ledger with OIST digital authentication signature"
            >
              <Printer size={14} />
              <span>print report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#94A3B8',
                padding: '6px',
                borderRadius: '8px',
                marginLeft: '6px'
              }}
              title="Close Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. TABS: attendance consideration list / leave list
            & TOOLBAR FILTERS: [Select semester] | Select section | Search
            ========================================================================= */}
        <div
          style={{
            padding: '0.85rem 2rem',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          {/* Tabs: Attendance Consideration vs Leave List */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '12px' }}>
            <button
              type="button"
              id="tab-btn-attendance-consideration"
              onClick={() => setActiveTab('attendance')}
              style={{
                padding: '7px 18px',
                borderRadius: '9px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'attendance' ? '#2563EB' : 'transparent',
                color: activeTab === 'attendance' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'attendance' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              attendance consideration list ({filteredConsiderations.length})
            </button>

            <button
              type="button"
              id="tab-btn-leave-list"
              onClick={() => setActiveTab('leaves')}
              style={{
                padding: '7px 18px',
                borderRadius: '9px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'leaves' ? '#2563EB' : 'transparent',
                color: activeTab === 'leaves' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'leaves' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              leave list ({filteredLeaves.length})
            </button>
          </div>

          {/* Filter Controls: Select Semester, Select Section, Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* SELECT SEMESTER (Key System Workflow Step) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                padding: '3px 8px',
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1E293B', textTransform: 'lowercase' }}>
                select semester:
              </span>
              <select
                id="select-ledger-semester"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1E40AF',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE',
                  backgroundColor: '#EFF6FF',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '3px 8px',
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'lowercase' }}>
                section:
              </span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All</option>
                {['A', 'B', 'C', 'D'].map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Live Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '4px 10px',
                backgroundColor: '#FFFFFF',
                minWidth: '220px'
              }}
            >
              <Search size={14} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search student or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  width: '100%',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. TABLE BANNER - MATCHING EXACT USER WIREFRAME
            ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
            Department of Computer Science & Engineering - CampusFlow ERP
            Official Approved Clearances & Sanctioned Requests Ledger
            ========================================================================= */}
        <div
          style={{
            padding: '0.65rem 2rem',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ledger View:
            </span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
              {currentCategoryLabel}
            </span>
          </div>

          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
            Showing <strong>{currentRecords.length}</strong> record(s) &bull; Filtered by:{' '}
            <span style={{ color: '#1D4ED8', fontWeight: 700 }}>
              {selectedSemester === 'ALL' ? 'All Semesters' : `Semester ${selectedSemester}`}
            </span>
          </div>
        </div>

        {/* =========================================================================
            4. MAIN TABLE BODY
            Strictly matches the 2-tier header sketch:
            student name | enrollment | section | periods | time (from | to) | date (from | to) | number of days
            ========================================================================= */}
        <div style={{ padding: '1rem 2rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748B' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#2563EB' }} />
              <p style={{ fontSize: '13px', margin: 0, fontWeight: 600 }}>
                Loading clearances & verified ledger entries...
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                border: '1.5px solid #CBD5E1',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  {/* ROW 1 OF HEADER */}
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', color: '#0F172A' }}>
                    <th
                      rowSpan={2}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        borderRight: '1px solid #CBD5E1',
                        verticalAlign: 'middle',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '20%'
                      }}
                    >
                      student name
                    </th>

                    <th
                      rowSpan={2}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        borderRight: '1px solid #CBD5E1',
                        verticalAlign: 'middle',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '14%'
                      }}
                    >
                      enrollment
                    </th>

                    <th
                      rowSpan={2}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        verticalAlign: 'middle',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '7%'
                      }}
                    >
                      section
                    </th>

                    <th
                      rowSpan={2}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        borderRight: '1px solid #CBD5E1',
                        verticalAlign: 'middle',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '18%'
                      }}
                    >
                      periods
                    </th>

                    {/* TIME (ColSpan 2) */}
                    <th
                      colSpan={2}
                      style={{
                        padding: '8px 12px',
                        fontWeight: 800,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        borderBottom: '1px solid #CBD5E1',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '16%'
                      }}
                    >
                      time
                    </th>

                    {/* DATE (ColSpan 2) */}
                    <th
                      colSpan={2}
                      style={{
                        padding: '8px 12px',
                        fontWeight: 800,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        borderBottom: '1px solid #CBD5E1',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '16%'
                      }}
                    >
                      date
                    </th>

                    <th
                      rowSpan={2}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                        width: '9%'
                      }}
                    >
                      number of days
                    </th>
                  </tr>

                  {/* ROW 2 OF HEADER: Sub-columns under time (from | to) and date (from | to) */}
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1.5px solid #CBD5E1', color: '#475569', fontSize: '11px' }}>
                    <th
                      style={{
                        padding: '6px 10px',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        textTransform: 'lowercase'
                      }}
                    >
                      from
                    </th>
                    <th
                      style={{
                        padding: '6px 10px',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        textTransform: 'lowercase'
                      }}
                    >
                      to
                    </th>
                    <th
                      style={{
                        padding: '6px 10px',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        textTransform: 'lowercase'
                      }}
                    >
                      from
                    </th>
                    <th
                      style={{
                        padding: '6px 10px',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRight: '1px solid #CBD5E1',
                        textTransform: 'lowercase'
                      }}
                    >
                      to
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3.5rem', textAlign: 'center', color: '#94A3B8' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>No entries found</div>
                        <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                          No {activeTab === 'attendance' ? 'attendance consideration' : 'leave'} records match the selected semester / section filter.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((item, idx) => {
                      const ledger = parseRecordForLedger(item);

                      return (
                        <tr
                          key={ledger.id || idx}
                          style={{
                            borderBottom: idx < currentRecords.length - 1 ? '1px solid #E2E8F0' : 'none',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                          }}
                        >
                          {/* 1. Student Name */}
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #E2E8F0' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                              {ledger.studentName}
                            </div>
                            {ledger.reason && ledger.reason !== '—' && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontStyle: 'italic' }}>
                                {ledger.reason}
                              </div>
                            )}
                          </td>

                          {/* 2. Enrollment */}
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                            {ledger.enrollment}
                          </td>

                          {/* 3. Section */}
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: '#EFF6FF',
                                color: '#1D4ED8',
                                border: '1px solid #BFDBFE'
                              }}
                            >
                              {ledger.section}
                            </span>
                          </td>

                          {/* 4. Periods */}
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 600, fontSize: '12px' }}>
                            {ledger.periods}
                          </td>

                          {/* 5. Time From */}
                          <td style={{ padding: '10px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {ledger.timeFrom}
                          </td>

                          {/* 6. Time To */}
                          <td style={{ padding: '10px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {ledger.timeTo}
                          </td>

                          {/* 7. Date From */}
                          <td style={{ padding: '10px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {ledger.dateFrom}
                          </td>

                          {/* 8. Date To */}
                          <td style={{ padding: '10px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {ledger.dateTo}
                          </td>

                          {/* 9. Number of Days */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                backgroundColor: '#ECFDF5',
                                color: '#065F46',
                                border: '1px solid #A7F3D0'
                              }}
                            >
                              {ledger.numberOfDays} {ledger.numberOfDays > 1 ? 'Days' : 'Day'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =========================================================================
            5. MODAL FOOTER
            ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 2rem',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Authorized Sign-off: <strong>{authorizedByTitle}</strong> &bull; Department of CSE
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 22px',
                borderRadius: '9px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                cursor: 'pointer'
              }}
            >
              Close Ledger
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          6. "SELECT SEMESTER" DIALOG FOR EXPORT
          Directly matches the diagram flow:
          [export excel / csv / print report] -> [Select semester] -> downloadable report
          ========================================================================= */}
      {showExportSemesterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowExportSemesterModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.3)',
              border: '1px solid #CBD5E1'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Select Semester
                  </h4>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Choose semester for downloadable report ({pendingExportFormat?.toUpperCase()})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExportSemesterModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Target Semester:
              </label>
              <select
                value={exportTargetSemester}
                onChange={(e) => setExportTargetSemester(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #2563EB',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1E293B',
                  outline: 'none',
                  backgroundColor: '#F8FAFC'
                }}
              >
                <option value="ALL">All Semesters (Comprehensive Ledger)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowExportSemesterModal(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSemesterExport}
                style={{
                  padding: '7px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                }}
              >
                {pendingExportFormat === 'print' ? <Printer size={13} /> : <Download size={13} />}
                <span>
                  {pendingExportFormat === 'print'
                    ? 'Generate PDF / Print'
                    : pendingExportFormat === 'excel'
                      ? 'Download .xlsx / .xls'
                      : 'Download CSV'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. GOOGLE LIVE SHEET INTEGRATION MODAL
          ========================================================================= */}
      {showGoogleSheetModal && (
        <GoogleSheetSyncModal
          onClose={() => setShowGoogleSheetModal(false)}
          totalApprovedCount={currentRecords.length}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
