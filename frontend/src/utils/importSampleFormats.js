// ============================================================================
// Departmental ERP - Master Data Import Specifications & Sample Data Formats
// Complete schema, column requirements, and sample datasets for:
// 1. Teachers / Faculty
// 2. Students
// 3. Subjects / Curriculum
// 4. Classrooms / Labs
// 5. Timetables / Schedule
// ============================================================================

export const IMPORT_SAMPLE_FORMATS = {
  teachers: {
    id: 'teachers',
    title: 'Faculty & Teachers',
    subtitle: 'Upload Excel (.xlsx) or CSV spreadsheet to validate and import teachers into the departmental roster.',
    filename: 'teachers_import_sample_template',
    columns: [
      {
        key: 'Employee ID',
        aliases: ['EmployeeId', 'employeeId', 'Emp ID'],
        required: false,
        type: 'Alphanumeric',
        description: 'Unique institution faculty ID (e.g. EMP1001). If left blank, a unique ID is auto-generated.',
        example: 'EMP1001'
      },
      {
        key: 'Name',
        aliases: ['Full Name', 'Teacher Name', 'name'],
        required: true,
        type: 'Text',
        description: 'Full name of the faculty member. Automatically splits into first and last name.',
        example: 'Dr. Rajesh Sharma'
      },
      {
        key: 'Email',
        aliases: ['Email Address', 'email'],
        required: true,
        type: 'Email',
        description: 'Official academic email address. Must be valid, unique, and include @.',
        example: 'rajesh.sharma@oist.edu.in'
      },
      {
        key: 'Designation',
        aliases: ['designation', 'Post'],
        required: false,
        type: 'Text',
        description: 'Academic rank (Professor, Associate Professor, Assistant Professor, HOD). Default: Assistant Professor.',
        example: 'Professor'
      },
      {
        key: 'Phone',
        aliases: ['Contact', 'Mobile', 'phone'],
        required: false,
        type: 'Phone / Number',
        description: '10-digit mobile number for departmental contact.',
        example: '9876543210'
      },
      {
        key: 'Is TG',
        aliases: ['isTG', 'TG', 'Is Teacher Guardian'],
        required: false,
        type: 'Boolean (Yes/No)',
        description: 'Flag whether this faculty member is appointed as Teacher Guardian (TG). Accept: Yes, No, true, false.',
        example: 'Yes'
      }
    ],
    sampleRows: [
      {
        'Employee ID': 'EMP1001',
        'Name': 'Dr. Rajesh Sharma',
        'Email': 'rajesh.sharma@oist.edu.in',
        'Designation': 'Professor',
        'Phone': '9876543210',
        'Is TG': 'Yes'
      },
      {
        'Employee ID': 'EMP1002',
        'Name': 'Prof. Sunita Verma',
        'Email': 'sunita.verma@oist.edu.in',
        'Designation': 'Associate Professor',
        'Phone': '9876543211',
        'Is TG': 'No'
      },
      {
        'Employee ID': 'EMP1003',
        'Name': 'Er. Amit Patel',
        'Email': 'amit.patel@oist.edu.in',
        'Designation': 'Assistant Professor',
        'Phone': '9876543212',
        'Is TG': 'Yes'
      },
      {
        'Employee ID': 'EMP1004',
        'Name': 'Dr. Priya Nair',
        'Email': 'priya.nair@oist.edu.in',
        'Designation': 'Assistant Professor',
        'Phone': '9876543213',
        'Is TG': 'No'
      }
    ],
    rules: [
      'Column headers must be in Row 1 of your spreadsheet.',
      'Name and Email are mandatory fields for every teacher.',
      'Emails and Employee IDs must be unique across the entire institution database.',
      'A default login account is created for each teacher with default credentials (Teacher@123).'
    ]
  },

  students: {
    id: 'students',
    title: 'Student Roster',
    subtitle: 'Upload Excel (.xlsx) or CSV spreadsheet to validate and enroll students into sections.',
    filename: 'students_import_sample_template',
    columns: [
      {
        key: 'Enrollment No',
        aliases: ['EnrollmentNo', 'Roll No', 'rollNo', 'enrollmentNo'],
        required: true,
        type: 'Alphanumeric',
        description: 'Official university enrollment number (e.g. 0111CS211001). Must be unique.',
        example: '0111CS211001'
      },
      {
        key: 'Name',
        aliases: ['Student Name', 'Full Name', 'name'],
        required: true,
        type: 'Text',
        description: 'Full name of the student. Automatically splits into first and last name.',
        example: 'Aarav Sharma'
      },
      {
        key: 'Email',
        aliases: ['Email Address', 'email'],
        required: true,
        type: 'Email',
        description: 'Official student email address. Must be unique and include @.',
        example: 'aarav.sharma@student.oist.edu.in'
      },
      {
        key: 'Batch',
        aliases: ['Academic Batch', 'batch', 'academicBatch'],
        required: false,
        type: 'Text (YYYY-YYYY)',
        description: 'Academic admission batch (e.g. 2022-2026). Matched during student self-registration verification.',
        example: '2022-2026'
      },
      {
        key: 'Semester',
        aliases: ['semester', 'Sem'],
        required: false,
        type: 'Integer (1-8)',
        description: 'Current academic semester number. Default: 5.',
        example: '5'
      },
      {
        key: 'Section',
        aliases: ['section', 'Sec'],
        required: false,
        type: 'Text (A, B, C...)',
        description: 'Assigned classroom section code. Matched against active department sections. Default: A.',
        example: 'A'
      },
      {
        key: 'Phone',
        aliases: ['Contact', 'phone'],
        required: false,
        type: 'Phone / Number',
        description: '10-digit mobile number for communication.',
        example: '9123456780'
      }
    ],
    sampleRows: [
      {
        'Enrollment No': '0111CS211001',
        'Name': 'Aarav Sharma',
        'Email': 'aarav.sharma@student.oist.edu.in',
        'Batch': '2022-2026',
        'Semester': '5',
        'Section': 'A',
        'Phone': '9123456780'
      },
      {
        'Enrollment No': '0111CS211002',
        'Name': 'Diya Patel',
        'Email': 'diya.patel@student.oist.edu.in',
        'Batch': '2022-2026',
        'Semester': '5',
        'Section': 'A',
        'Phone': '9123456781'
      },
      {
        'Enrollment No': '0111CS211003',
        'Name': 'Rohan Gupta',
        'Email': 'rohan.gupta@student.oist.edu.in',
        'Batch': '2022-2026',
        'Semester': '5',
        'Section': 'B',
        'Phone': '9123456782'
      },
      {
        'Enrollment No': '0111CS211004',
        'Name': 'Ananya Singh',
        'Email': 'ananya.singh@student.oist.edu.in',
        'Batch': '2021-2025',
        'Semester': '6',
        'Section': 'A',
        'Phone': '9123456783'
      }
    ],
    rules: [
      'Enrollment No, Name, and Email are mandatory fields for every student row.',
      'Duplicate enrollment numbers or emails will be flagged during the dry-run validation preview.',
      'Section names are matched automatically to existing department sections (e.g., Section A, Section B).',
      'A student user account is created automatically with default credentials (Student@123).'
    ]
  },

  subjects: {
    id: 'subjects',
    title: 'Course Subjects',
    subtitle: 'Upload Excel (.xlsx) or CSV spreadsheet to add courses and subjects into the academic curriculum.',
    filename: 'subjects_import_sample_template',
    columns: [
      {
        key: 'Code',
        aliases: ['Subject Code', 'code'],
        required: true,
        type: 'Alphanumeric',
        description: 'Official course subject code (e.g. CS501). Must be unique.',
        example: 'CS501'
      },
      {
        key: 'Name',
        aliases: ['Subject Name', 'name'],
        required: true,
        type: 'Text',
        description: 'Full course or subject title.',
        example: 'Theory of Computation'
      },
      {
        key: 'Semester',
        aliases: ['semester', 'Sem'],
        required: false,
        type: 'Integer (1-8)',
        description: 'Semester in which this subject is taught. Default: 5.',
        example: '5'
      },
      {
        key: 'Credits',
        aliases: ['credits', 'Credit'],
        required: false,
        type: 'Integer',
        description: 'Academic credit score for this subject. Default: 4.',
        example: '4'
      },
      {
        key: 'Weekly Hours',
        aliases: ['weeklyHours', 'Periods', 'Hours'],
        required: false,
        type: 'Integer',
        description: 'Number of lecture periods assigned per week. Default: 4.',
        example: '4'
      },
      {
        key: 'Is Elective',
        aliases: ['isElective', 'Elective'],
        required: false,
        type: 'Boolean (Yes/No)',
        description: 'Flag whether subject is an elective course. Accept: Yes, No, true, false. Default: No.',
        example: 'No'
      }
    ],
    sampleRows: [
      {
        'Code': 'CS501',
        'Name': 'Theory of Computation',
        'Semester': '5',
        'Credits': '4',
        'Weekly Hours': '4',
        'Is Elective': 'No'
      },
      {
        'Code': 'CS502',
        'Name': 'Database Management Systems',
        'Semester': '5',
        'Credits': '4',
        'Weekly Hours': '4',
        'Is Elective': 'No'
      },
      {
        'Code': 'CS503',
        'Name': 'Computer Networks',
        'Semester': '5',
        'Credits': '4',
        'Weekly Hours': '4',
        'Is Elective': 'No'
      },
      {
        'Code': 'CS504',
        'Name': 'Artificial Intelligence',
        'Semester': '5',
        'Credits': '3',
        'Weekly Hours': '3',
        'Is Elective': 'Yes'
      }
    ],
    rules: [
      'Subject Code and Subject Name are required fields.',
      'Subject Code must be unique across the curriculum.',
      'Credits and Weekly Hours must be positive integers.'
    ]
  },

  classrooms: {
    id: 'classrooms',
    title: 'Classrooms & Labs',
    subtitle: 'Upload Excel (.xlsx) or CSV spreadsheet to register physical lecture halls, labs, and seminar rooms.',
    filename: 'classrooms_import_sample_template',
    columns: [
      {
        key: 'Room Number',
        aliases: ['roomNumber', 'Room', 'Room No'],
        required: true,
        type: 'Alphanumeric',
        description: 'Unique room identifier (e.g. CR-301, LAB-101). Must be unique.',
        example: 'CR-301'
      },
      {
        key: 'Type',
        aliases: ['type', 'Room Type'],
        required: false,
        type: 'Enum (LECTURE_HALL / LAB / SEMINAR_HALL)',
        description: 'Space classification. Allowed values: LECTURE_HALL, LAB, SEMINAR_HALL. Default: LECTURE_HALL.',
        example: 'LECTURE_HALL'
      },
      {
        key: 'Capacity',
        aliases: ['capacity', 'Seats'],
        required: false,
        type: 'Integer',
        description: 'Student seating capacity. Default: 60.',
        example: '60'
      },
      {
        key: 'Building',
        aliases: ['building', 'Block'],
        required: false,
        type: 'Text',
        description: 'Academic block or building name. Default: CSE Block.',
        example: 'CSE Block'
      },
      {
        key: 'Floor',
        aliases: ['floor'],
        required: false,
        type: 'Integer',
        description: 'Floor number where the room is situated. Default: 1.',
        example: '3'
      }
    ],
    sampleRows: [
      {
        'Room Number': 'CR-301',
        'Type': 'LECTURE_HALL',
        'Capacity': '60',
        'Building': 'CSE Block',
        'Floor': '3'
      },
      {
        'Room Number': 'CR-302',
        'Type': 'LECTURE_HALL',
        'Capacity': '60',
        'Building': 'CSE Block',
        'Floor': '3'
      },
      {
        'Room Number': 'LAB-101',
        'Type': 'LAB',
        'Capacity': '40',
        'Building': 'CSE Block',
        'Floor': '1'
      },
      {
        'Room Number': 'SEM-01',
        'Type': 'SEMINAR_HALL',
        'Capacity': '120',
        'Building': 'CSE Block',
        'Floor': '2'
      }
    ],
    rules: [
      'Room Number is required and must be unique.',
      'Type accepts LECTURE_HALL, LAB, or SEMINAR_HALL (if omitted, defaults to LECTURE_HALL).',
      'Capacity specifies maximum seating limit for timetable collision prevention.'
    ]
  },

  timetables: {
    id: 'timetables',
    title: 'Timetable Records',
    subtitle: 'Upload Excel (.xlsx) or CSV spreadsheet to schedule lecture periods, teacher assignments, and room allocations.',
    filename: 'timetable_import_sample_template',
    columns: [
      {
        key: 'Day',
        aliases: ['day', 'Day of Week'],
        required: true,
        type: 'Enum (Monday - Saturday)',
        description: 'Day of the week: Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday.',
        example: 'Monday'
      },
      {
        key: 'Period',
        aliases: ['period', 'Period Number'],
        required: false,
        type: 'Integer (1-8)',
        description: 'Slot period index (1 to 8). Default: 1.',
        example: '1'
      },
      {
        key: 'Start Time',
        aliases: ['startTime', 'From'],
        required: true,
        type: 'Time (HH:MM AM/PM)',
        description: 'Slot commencement time (e.g. 09:30 AM). Or use "Time Slot" e.g. 09:30 AM - 10:20 AM.',
        example: '09:30 AM'
      },
      {
        key: 'End Time',
        aliases: ['endTime', 'To'],
        required: true,
        type: 'Time (HH:MM AM/PM)',
        description: 'Slot conclusion time (e.g. 10:20 AM).',
        example: '10:20 AM'
      },
      {
        key: 'Subject',
        aliases: ['Subject Code', 'Subject Name', 'code'],
        required: true,
        type: 'Text',
        description: 'Subject code (e.g. CS501) or subject name. Must match an existing subject in the curriculum.',
        example: 'CS501'
      },
      {
        key: 'Teacher',
        aliases: ['Faculty', 'Faculty Member', 'teacher'],
        required: false,
        type: 'Text',
        description: 'Assigned teacher full name, employee ID, or email. Matches faculty directory.',
        example: 'Dr. Rajesh Sharma'
      },
      {
        key: 'Room',
        aliases: ['Classroom', 'Room / Lab', 'room'],
        required: false,
        type: 'Text',
        description: 'Allocated classroom or lab number (e.g. CR-301, LAB-101).',
        example: 'CR-301'
      },
      {
        key: 'Type',
        aliases: ['isLab', 'Slot Type'],
        required: false,
        type: 'Enum (Theory / Lab)',
        description: 'Slot instructional type: Theory or Lab. Default: Theory.',
        example: 'Theory'
      }
    ],
    sampleRows: [
      {
        'Day': 'Monday',
        'Period': '1',
        'Start Time': '09:30 AM',
        'End Time': '10:20 AM',
        'Subject': 'CS501',
        'Teacher': 'Dr. Rajesh Sharma',
        'Room': 'CR-301',
        'Type': 'Theory'
      },
      {
        'Day': 'Monday',
        'Period': '2',
        'Start Time': '10:20 AM',
        'End Time': '11:10 AM',
        'Subject': 'CS502',
        'Teacher': 'Prof. Sunita Verma',
        'Room': 'CR-301',
        'Type': 'Theory'
      },
      {
        'Day': 'Tuesday',
        'Period': '1',
        'Start Time': '09:30 AM',
        'End Time': '10:20 AM',
        'Subject': 'CS503',
        'Teacher': 'Er. Amit Patel',
        'Room': 'CR-301',
        'Type': 'Theory'
      },
      {
        'Day': 'Wednesday',
        'Period': '3',
        'Start Time': '11:20 AM',
        'End Time': '01:00 PM',
        'Subject': 'CS502',
        'Teacher': 'Prof. Sunita Verma',
        'Room': 'LAB-101',
        'Type': 'Lab'
      }
    ],
    rules: [
      'Day and Subject are mandatory.',
      'Subject should exist in the course subjects curriculum first for automatic linking.',
      'Start Time and End Time can be specified individually or together as "Time Slot" (e.g. 09:30 AM - 10:20 AM).',
      'Teacher and Room are automatically matched against the registered faculty roster and classroom list.'
    ]
  }
};

/**
 * Get sample format configuration for a given import type
 */
export const getSampleFormatConfig = (type) => {
  const normalized = type === 'timetable' ? 'timetables' : type;
  return IMPORT_SAMPLE_FORMATS[normalized] || IMPORT_SAMPLE_FORMATS.teachers;
};

/**
 * Convert sample rows of a format to CSV string
 */
export const generateSampleCsvString = (type) => {
  const config = getSampleFormatConfig(type);
  if (!config || !config.sampleRows || config.sampleRows.length === 0) return '';

  const headers = config.columns.map((c) => c.key);
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = config.sampleRows.map((row) =>
    headers.map((h) => escapeCell(row[h] !== undefined ? row[h] : '')).join(',')
  );

  return [headerLine, ...rowLines].join('\r\n');
};

/**
 * Trigger immediate browser download of the sample CSV
 */
export const downloadSampleCsvFile = (type) => {
  const config = getSampleFormatConfig(type);
  const csvContent = generateSampleCsvString(type);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${config.filename}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Copy sample CSV text to user clipboard
 */
export const copySampleCsvToClipboard = async (type) => {
  const csvContent = generateSampleCsvString(type);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(csvContent);
    return true;
  }
  return false;
};
