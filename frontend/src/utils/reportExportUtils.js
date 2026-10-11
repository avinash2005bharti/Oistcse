// ============================================================================
// CampusFlow ERP - Clearances & Sanctioned Requests Ledger Export Utilities
// Generates official reports in PDF/Print, Excel (.xls), and CSV
// Header: Oriental Institute of Science & Technology (OIST) - Dept. of CSE
// Columns: student name | enrollment | section | periods | time (from, to) | date (from, to) | number of days
// ============================================================================

export const parseRecordForLedger = (item) => {
  // 1. Student Name
  const studentName =
    item.studentName ||
    (item.student
      ? `${item.student.firstName || ''} ${item.student.lastName || ''}`.trim()
      : null) ||
    item.applicantName ||
    item.name ||
    'Student';

  // 2. Enrollment / Roll No
  const enrollment =
    item.enrollmentNo ||
    item.rollNo ||
    item.student?.enrollmentNo ||
    item.student?.rollNo ||
    '—';

  // 3. Section
  const section =
    (typeof item.section === 'object' && item.section !== null
      ? item.section.name
      : item.section) ||
    item.student?.section?.name ||
    item.student?.section ||
    '—';

  // 4. Semester
  const semester =
    item.semester ||
    item.student?.semester ||
    (typeof item.semester === 'number' ? item.semester : '—');

  // 5. Periods
  let periods = '1 Period';
  if (Array.isArray(item.selectedPeriods) && item.selectedPeriods.length > 0) {
    periods = item.selectedPeriods
      .map((p) => (typeof p === 'object' ? p.label || p.time || p.id || '' : p))
      .filter(Boolean)
      .join(', ');
  } else if (item.periodsTiming && item.periodsTiming.includes('(')) {
    periods = item.periodsTiming;
  } else if (item.approvedPeriodsCount) {
    periods = `${item.approvedPeriodsCount} Period${item.approvedPeriodsCount > 1 ? 's' : ''}`;
  } else if (item.periodsCount) {
    periods = `${item.periodsCount} Period${item.periodsCount > 1 ? 's' : ''}`;
  } else if (item.periods?.selectedPeriods && Array.isArray(item.periods.selectedPeriods)) {
    periods = item.periods.selectedPeriods.join(', ');
  } else if (item.periods?.periodsCount) {
    periods = `${item.periods.periodsCount} Period${item.periods.periodsCount > 1 ? 's' : ''}`;
  } else if (item.type === 'leave_request' || item.leaveType) {
    periods = 'All Periods';
  }

  // 6. Time (From / To)
  let timeFrom = '09:00 AM';
  let timeTo = '05:00 PM';
  const timingStr = item.periodsTiming || item.periods?.periodsTiming || '';

  if (timingStr) {
    const timeMatches = timingStr.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/g);
    if (timeMatches && timeMatches.length >= 2) {
      timeFrom = timeMatches[0];
      timeTo = timeMatches[timeMatches.length - 1];
    } else if (timeMatches && timeMatches.length === 1) {
      timeFrom = timeMatches[0];
      timeTo = timeMatches[0];
    } else {
      const parts = timingStr.split(/[-–—]/);
      if (parts.length >= 2) {
        timeFrom = parts[0].trim();
        timeTo = parts[1].trim();
      }
    }
  } else if (item.type === 'leave_request' || item.leaveType) {
    timeFrom = 'Full Day';
    timeTo = 'Full Day';
  }

  // 7. Date (From / To)
  const startRaw = item.startDate || item.date || item.createdAt;
  const endRaw = item.endDate || item.date || item.startDate || item.createdAt;
  const sDate = startRaw ? new Date(startRaw) : new Date();
  const eDate = endRaw ? new Date(endRaw) : sDate;

  const formatDateStr = (d) => {
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const dateFrom = formatDateStr(sDate);
  const dateTo = formatDateStr(eDate);

  // 8. Number of Days
  let numberOfDays = 1;
  if (item.totalDays && Number(item.totalDays) > 0) {
    numberOfDays = Number(item.totalDays);
  } else if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
    const diff = Math.max(0, eDate.getTime() - sDate.getTime());
    numberOfDays = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  // 9. Status & Category
  const status = (item.status || 'APPROVED').toUpperCase();
  const category =
    item.type === 'attendance_consideration'
      ? 'Attendance Consideration (OD)'
      : item.type === 'leave_request' || item.leaveType
        ? `Leave (${item.leaveType || 'General'})`
        : 'Attendance Dispute Query';

  return {
    id: item.id || '',
    studentName,
    enrollment,
    section,
    semester,
    periods,
    timeFrom,
    timeTo,
    dateFrom,
    dateTo,
    numberOfDays,
    status,
    category,
    reason: item.reason || item.title || '—'
  };
};

/**
 * Export ledger records to Excel (.xls HTML table workbook)
 * Matches the official two-tier header structure
 */
export const exportLedgerToExcel = ({
  records = [],
  semester = 'ALL',
  authorizedBy = 'Head of Department (HOD CSE)',
  categoryLabel = 'Official Approved Clearances & Sanctioned Requests Ledger'
}) => {
  if (!records || records.length === 0) return false;

  const parsedRows = records.map(parseRecordForLedger);
  const semText = semester && semester !== 'ALL' ? `Semester ${semester}` : 'All Semesters';

  const tableBody = parsedRows
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight: bold; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.studentName}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-family: monospace;">${r.enrollment}</td>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.section}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${r.periods}</td>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.timeFrom}</td>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.timeTo}</td>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.dateFrom}</td>
      <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.dateTo}</td>
      <td style="text-align: center; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.numberOfDays}</td>
      <td style="text-align: center; color: #047857; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px 10px;">${r.status}</td>
    </tr>
  `
    )
    .join('');

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .header-box { margin-bottom: 16px; }
        .title { font-size: 16pt; font-weight: bold; color: #1E3A8A; text-align: center; }
        .subtitle { font-size: 11pt; color: #475569; text-align: center; margin-top: 4px; }
        .ledger-title { font-size: 13pt; font-weight: bold; color: #0F172A; text-align: center; margin-top: 8px; border-bottom: 2px solid #1E3A8A; padding-bottom: 8px; }
        .meta { font-size: 10pt; color: #334155; margin: 10px 0; }
        table { border-collapse: collapse; width: 100%; font-size: 10.5pt; }
        th { background-color: #1E40AF; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #94A3B8; padding: 8px; }
        th.sub-th { background-color: #3B82F6; color: #FFFFFF; font-size: 9.5pt; }
        tr:nth-child(even) { background-color: #F8FAFC; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="title">ORIENTAL INSTITUTE OF SCIENCE &amp; TECHNOLOGY (OIST)</div>
        <div class="subtitle">Department of Computer Science &amp; Engineering &bull; CampusFlow ERP</div>
        <div class="ledger-title">${categoryLabel}</div>
        <div class="meta">
          <strong>Semester:</strong> ${semText} &nbsp;|&nbsp;
          <strong>Authorized by:</strong> ${authorizedBy} &nbsp;|&nbsp;
          <strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()} &nbsp;|&nbsp;
          <strong>Total Records:</strong> ${parsedRows.length}
        </div>
      </div>
      <table border="1">
        <thead>
          <tr>
            <th rowspan="2" style="width: 40px;">#</th>
            <th rowspan="2">student name</th>
            <th rowspan="2">enrollment</th>
            <th rowspan="2">section</th>
            <th rowspan="2">periods</th>
            <th colspan="2">time</th>
            <th colspan="2">date</th>
            <th rowspan="2">number of days</th>
            <th rowspan="2">status</th>
          </tr>
          <tr>
            <th class="sub-th">from</th>
            <th class="sub-th">to</th>
            <th class="sub-th">from</th>
            <th class="sub-th">to</th>
          </tr>
        </thead>
        <tbody>
          ${tableBody}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `OIST_Approved_Clearances_Ledger_${semText.replace(/\s+/g, '_')}_${dateStr}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

/**
 * Export ledger records to standard CSV (RFC 4180 compliant with UTF-8 BOM)
 */
export const exportLedgerToCSV = ({ records = [], semester = 'ALL' }) => {
  if (!records || records.length === 0) return false;

  const parsedRows = records.map(parseRecordForLedger);
  const headers = [
    'Student Name',
    'Enrollment',
    'Section',
    'Periods',
    'Time From',
    'Time To',
    'Date From',
    'Date To',
    'Number of Days',
    'Category',
    'Status'
  ];

  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const csvRows = parsedRows.map((r) =>
    [
      escapeCsv(r.studentName),
      escapeCsv(r.enrollment),
      escapeCsv(r.section),
      escapeCsv(r.periods),
      escapeCsv(r.timeFrom),
      escapeCsv(r.timeTo),
      escapeCsv(r.dateFrom),
      escapeCsv(r.dateTo),
      escapeCsv(r.numberOfDays),
      escapeCsv(r.category),
      escapeCsv(r.status)
    ].join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const semText = semester && semester !== 'ALL' ? `Sem_${semester}` : 'All_Sem';
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `OIST_Approved_Clearances_Ledger_${semText}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

/**
 * Open Print Window for Printable / PDF Ledger Report
 * Formats official document strictly per diagram specs
 */
export const printLedgerReport = ({
  records = [],
  semester = 'ALL',
  authorizedBy = 'Head of Department (HOD CSE)',
  categoryLabel = 'Official Approved Clearances & Sanctioned Requests Ledger'
}) => {
  if (!records || records.length === 0) return false;

  const parsedRows = records.map(parseRecordForLedger);
  const semText = semester && semester !== 'ALL' ? `Semester ${semester}` : 'All Semesters';

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) return false;

  const tableRowsHtml = parsedRows
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td class="student-name">${r.studentName}</td>
      <td class="enrollment">${r.enrollment}</td>
      <td style="text-align: center;">${r.section}</td>
      <td>${r.periods}</td>
      <td style="text-align: center; white-space: nowrap;">${r.timeFrom}</td>
      <td style="text-align: center; white-space: nowrap;">${r.timeTo}</td>
      <td style="text-align: center; white-space: nowrap;">${r.dateFrom}</td>
      <td style="text-align: center; white-space: nowrap;">${r.dateTo}</td>
      <td style="text-align: center; font-weight: bold;">${r.numberOfDays}</td>
      <td style="text-align: center;" class="status">${r.status}</td>
    </tr>
  `
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Official Approved Clearances & Sanctioned Requests Ledger - OIST CSE</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 10mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 1rem 1.5rem;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
          }
          .header {
            text-align: center;
            border-bottom: 2.5px solid #1e40af;
            padding-bottom: 0.75rem;
            margin-bottom: 1rem;
          }
          .inst-name {
            font-size: 18px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin: 0;
          }
          .dept-sub {
            font-size: 11.5px;
            color: #475569;
            font-weight: 600;
            margin-top: 3px;
          }
          .ledger-banner {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 8px;
            text-transform: capitalize;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 12px;
            margin-bottom: 1rem;
            font-size: 11px;
            font-weight: 600;
            color: #334155;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            page-break-inside: auto;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th {
            background-color: #f1f5f9;
            color: #0f172a;
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            font-weight: 800;
            text-transform: lowercase;
            letter-spacing: -0.01em;
            vertical-align: middle;
          }
          th.sub-head {
            font-size: 9.5px;
            font-weight: 700;
            color: #475569;
            padding: 4px 6px;
            background-color: #f8fafc;
          }
          td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            vertical-align: middle;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          .student-name { font-weight: 700; color: #0f172a; }
          .enrollment { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; color: #475569; }
          .status { color: #047857; font-weight: 800; font-size: 10px; }
          .footer {
            margin-top: 2.5rem;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
            padding: 0 1rem;
          }
          .signature-box {
            border-top: 1.5px dashed #94a3b8;
            width: 250px;
            text-align: center;
            padding-top: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #334155;
          }
          .signature-sub {
            font-size: 9px;
            color: #64748b;
            font-weight: 500;
            margin-top: 2px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="inst-name">ORIENTAL INSTITUTE OF SCIENCE &amp; TECHNOLOGY (OIST)</div>
          <div class="dept-sub">Department of Computer Science &amp; Engineering &bull; CampusFlow ERP</div>
          <div class="ledger-banner">${categoryLabel}</div>
        </div>

        <div class="meta-bar">
          <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}</span>
          <span><strong>Semester:</strong> ${semText}</span>
          <span><strong>Authorized by:</strong> ${authorizedBy}</span>
          <span><strong>Total Records:</strong> ${parsedRows.length} Sanctioned</span>
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px; text-align: center;">#</th>
              <th rowspan="2" style="text-align: left; width: 17%;">student name</th>
              <th rowspan="2" style="text-align: left; width: 12%;">enrollment</th>
              <th rowspan="2" style="text-align: center; width: 6%;">section</th>
              <th rowspan="2" style="text-align: left; width: 19%;">periods</th>
              <th colspan="2" style="text-align: center; width: 14%;">time</th>
              <th colspan="2" style="text-align: center; width: 16%;">date</th>
              <th rowspan="2" style="text-align: center; width: 8%;">number of days</th>
              <th rowspan="2" style="text-align: center; width: 8%;">status</th>
            </tr>
            <tr>
              <th class="sub-head" style="text-align: center;">from</th>
              <th class="sub-head" style="text-align: center;">to</th>
              <th class="sub-head" style="text-align: center;">from</th>
              <th class="sub-head" style="text-align: center;">to</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div class="signature-box">
            Department ERP Coordinator
            <div class="signature-sub">OIST Bhopal &bull; Administrative Desk</div>
          </div>
          <div class="signature-box">
            ${authorizedBy}
            <div class="signature-sub">(Digital Authentication Signature &bull; Verified Record)</div>
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
  return true;
};
