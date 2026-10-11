import React from 'react';
import { useERP } from '../../context/ERPContext';
import { Activity, Download, Users, Award, ShieldCheck, CheckSquare, BarChart2, BookOpen } from 'lucide-react';

export default function HodReports() {
  const { students, subjects, teachers, sections, dashboardData, addToast } = useERP();

  const totalStudents = dashboardData?.totalStudents ?? students.length;
  const totalFaculty = dashboardData?.totalTeachers ?? teachers.length;
  const avgAttendance = dashboardData?.departmentAttendance ?? (
    students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + (s.attendance || 0), 0) / students.length)
      : 0
  );

  const handleExport = () => {
    // Generate real CSV from current student records
    const headers = ['Enrollment No', 'Name', 'Semester', 'Section', 'Attendance (%)', 'Status'];
    const rows = students.map((s) => [
      s.enrollment_no || s.rollNo || '',
      `"${s.name || ''}"`,
      s.semester || '',
      s.section || '',
      s.attendance || 0,
      s.status || 'Active'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CSE_Department_Academic_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Report Exported', 'Departmental Attendance & Academic Audit Report downloaded (CSV).', 'success');
  };

  return (
    <div className="page-wrapper">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Department Reports & Analytics</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance aggregates, faculty teaching loads & clearance performance audit
            </p>
          </div>

          <button
            onClick={handleExport}
            className="btn btn-primary text-xs py-2 px-4 shadow-sm"
            id="btn-export-audit"
          >
            <Download size={15} />
            <span>Export Department Audit (CSV)</span>
          </button>
        </div>

        {/* High-level KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="card flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Department Aggregate Attendance</span>
              <div className="text-2xl font-extrabold text-emerald-600">{avgAttendance}%</div>
              <span className="text-[11px] text-slate-400">
                {avgAttendance >= 75 ? 'Above statutory threshold (≥75%)' : 'Below statutory threshold (<75%)'}
              </span>
            </div>
          </div>

          <div className="card flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Active Enrolled Students</span>
              <div className="text-2xl font-extrabold text-slate-900">{totalStudents} Students</div>
              <span className="text-[11px] text-blue-600">Across {sections.length || 6} CSE Sections</span>
            </div>
          </div>

          <div className="card flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Faculty Roster</span>
              <div className="text-2xl font-extrabold text-indigo-700">{totalFaculty} Faculty Members</div>
              <span className="text-[11px] text-emerald-600">Active teaching staff</span>
            </div>
          </div>
        </div>

        {/* Subject-Wise Overview */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Curriculum Course Schemes</h2>
            <span className="text-xs text-slate-500">{subjects.length} Subjects Registered</span>
          </div>

          {subjects.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No curriculum subjects registered in database.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {subjects.map((sub) => (
                <div key={sub.id || sub.code} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{sub.name}</span>
                    <span className="text-slate-500">{sub.code} • Semester {sub.semester} • Credits: {sub.credits}</span>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-indigo text-xs">
                      {sub.credits} Credits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
