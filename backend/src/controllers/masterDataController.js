// ============================================================================
// Departmental ERP - Master Data Management & Bulk Import/Export Controller
// Single Source of Truth: PostgreSQL via Prisma
// ============================================================================

const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/postgres');
const { StudentPreData } = require('../models/mongo');
const { logger } = require('../services/loggerService');

// Helper to parse file buffer (XLSX or CSV) into JSON array
const parseFileBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return xlsx.utils.sheet_to_json(worksheet, { defval: '' });
};

// ----------------------------------------------------------------------------
// 1. TEACHERS BULK IMPORT & EXPORT
// ----------------------------------------------------------------------------
exports.importTeachers = async (req, res) => {
  try {
    let rows = [];
    if (req.file) {
      rows = parseFileBuffer(req.file.buffer);
    } else if (Array.isArray(req.body.records) || Array.isArray(req.body.teachers)) {
      rows = req.body.records || req.body.teachers;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No teacher rows found in the uploaded data.' });
    }

    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;

    // Fetch existing records for duplicate detection
    const [existingTeachers, defaultDept, teacherRole] = await Promise.all([
      prisma.teacher.findMany({ select: { email: true, employeeId: true } }),
      prisma.department.findFirst(),
      prisma.role.findFirst({ where: { name: 'TEACHER' } })
    ]);

    const existingEmails = new Set(existingTeachers.map(t => t.email.toLowerCase()));
    const existingEmpIds = new Set(existingTeachers.map(t => t.employeeId.toUpperCase()));

    const fileEmails = new Set();
    const fileEmpIds = new Set();

    const validRows = [];
    const errors = [];

    const defaultPasswordHash = await bcrypt.hash('Teacher@123', 10);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Assuming row 1 is header

      const name = (row['Name'] || row['name'] || row['Full Name'] || row['Teacher Name'] || '').trim();
      const email = (row['Email'] || row['email'] || row['Email Address'] || '').trim().toLowerCase();
      let employeeId = (row['Employee ID'] || row['EmployeeId'] || row['employeeId'] || row['Emp ID'] || '').trim().toUpperCase();
      const designation = (row['Designation'] || row['designation'] || 'Assistant Professor').trim();
      const phone = (row['Phone'] || row['phone'] || row['Contact'] || '').trim();
      const isTG = String(row['isTG'] || row['TG'] || row['Is TG'] || '').toLowerCase() === 'true' || String(row['isTG']) === '1';

      if (!name) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Name is required.` });
        continue;
      }
      if (!email || !email.includes('@')) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Invalid or missing email address (${email || 'Empty'}).` });
        continue;
      }

      if (!employeeId) {
        employeeId = `EMP${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Check duplicates
      if (existingEmails.has(email)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Email '${email}' already exists in database.` });
        continue;
      }
      if (existingEmpIds.has(employeeId)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Employee ID '${employeeId}' already exists in database.` });
        continue;
      }
      if (fileEmails.has(email)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate email '${email}' found inside the same file.` });
        continue;
      }
      if (fileEmpIds.has(employeeId)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate Employee ID '${employeeId}' found inside the same file.` });
        continue;
      }

      fileEmails.add(email);
      fileEmpIds.add(employeeId);

      const parts = name.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';

      validRows.push({
        rowNum,
        name,
        firstName,
        lastName,
        email,
        employeeId,
        designation,
        phone: phone || null,
        isTG,
        departmentId: defaultDept?.id
      });
    }

    // Dry Run Preview Mode
    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        preview: validRows.slice(0, 10),
        errors
      });
    }

    // Commit Import to PostgreSQL
    const createdTeachers = [];
    await prisma.$transaction(async (tx) => {
      for (const item of validRows) {
        const user = await tx.user.create({
          data: {
            name: item.name,
            email: item.email,
            passwordHash: defaultPasswordHash,
            roleId: teacherRole.id,
            departmentId: item.departmentId,
            isActive: true
          }
        });

        const teacher = await tx.teacher.create({
          data: {
            userId: user.id,
            employeeId: item.employeeId,
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            phone: item.phone,
            designation: item.designation,
            departmentId: item.departmentId,
            isTG: item.isTG,
            status: 'ACTIVE'
          }
        });

        createdTeachers.push(teacher);
      }
    });

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdTeachers.length} teachers into database.`,
      importedCount: createdTeachers.length,
      skippedCount: errors.length,
      errors
    });
  } catch (error) {
    logger.error(`[Master Data] Import Teachers error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { department: true },
      orderBy: { employeeId: 'asc' }
    });

    const data = teachers.map(t => ({
      'Employee ID': t.employeeId,
      'Name': `${t.firstName} ${t.lastName || ''}`.trim(),
      'Email': t.email,
      'Phone': t.phone || '',
      'Designation': t.designation,
      'Department': t.department?.code || 'CSE',
      'Is TG': t.isTG ? 'Yes' : 'No',
      'Status': t.status,
      'Max Workload (Per Day)': t.maxPeriodsPerDay,
      'Max Workload (Per Week)': t.maxPeriodsPerWeek
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Teachers_Directory');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=teachers_master_data.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 2. STUDENTS BULK IMPORT & EXPORT
// ----------------------------------------------------------------------------
exports.importStudents = async (req, res) => {
  try {
    let rows = [];
    if (req.file) {
      rows = parseFileBuffer(req.file.buffer);
    } else if (Array.isArray(req.body.records) || Array.isArray(req.body.students)) {
      rows = req.body.records || req.body.students;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No student rows found in the uploaded file.' });
    }

    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;

    const [existingStudents, defaultDept, sections, studentRole] = await Promise.all([
      prisma.student.findMany({ select: { enrollmentNo: true, email: true } }),
      prisma.department.findFirst(),
      prisma.section.findMany(),
      prisma.role.findFirst({ where: { name: 'STUDENT' } })
    ]);

    const existingEnrollments = new Set(existingStudents.map(s => s.enrollmentNo.toUpperCase()));
    const existingEmails = new Set(existingStudents.map(s => s.email.toLowerCase()));

    const fileEnrollments = new Set();
    const fileEmails = new Set();

    const validRows = [];
    const errors = [];
    const defaultPasswordHash = await bcrypt.hash('Student@123', 10);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = (row['Name'] || row['name'] || row['Full Name'] || row['Student Name'] || '').trim();
      const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
      const enrollmentNo = (row['Enrollment No'] || row['EnrollmentNo'] || row['enrollmentNo'] || row['Roll No'] || row['rollNo'] || '').trim().toUpperCase();
      const batch = (row['Batch'] || row['batch'] || row['Academic Batch'] || '2022-2026').trim();
      const semester = parseInt(row['Semester'] || row['semester'] || 5, 10);
      const sectionName = (row['Section'] || row['section'] || 'A').trim().toUpperCase();
      const phone = (row['Phone'] || row['phone'] || '').trim();

      if (!name) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Name is required.` });
        continue;
      }
      if (!enrollmentNo) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Enrollment number is required.` });
        continue;
      }
      if (!email || !email.includes('@')) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Invalid or missing email address (${email || 'Empty'}).` });
        continue;
      }

      if (existingEnrollments.has(enrollmentNo)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Enrollment No '${enrollmentNo}' already exists in database.` });
        continue;
      }
      if (existingEmails.has(email)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Email '${email}' already exists in database.` });
        continue;
      }
      if (fileEnrollments.has(enrollmentNo)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate Enrollment No '${enrollmentNo}' inside the file.` });
        continue;
      }
      if (fileEmails.has(email)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate Email '${email}' inside the file.` });
        continue;
      }

      fileEnrollments.add(enrollmentNo);
      fileEmails.add(email);

      // Match section
      const secMatch = sections.find(s => s.name === sectionName);

      const parts = name.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';

      validRows.push({
        rowNum,
        name,
        firstName,
        lastName,
        email,
        enrollmentNo,
        batch,
        semester,
        sectionName,
        sectionId: secMatch?.id || sections[0]?.id || null,
        phone: phone || null,
        departmentId: defaultDept?.id
      });
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        preview: validRows.slice(0, 10),
        errors
      });
    }

    const createdStudents = [];
    await prisma.$transaction(async (tx) => {
      for (const item of validRows) {
        const user = await tx.user.create({
          data: {
            name: item.name,
            email: item.email,
            passwordHash: defaultPasswordHash,
            roleId: studentRole.id,
            departmentId: item.departmentId,
            isActive: true
          }
        });

        const student = await tx.student.create({
          data: {
            userId: user.id,
            enrollmentNo: item.enrollmentNo,
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            phone: item.phone,
            semester: item.semester,
            sectionId: item.sectionId,
            departmentId: item.departmentId,
            status: 'ACTIVE'
          }
        });
        createdStudents.push(student);
      }
    });

    // Populate and sync pre-data into MongoDB StudentPreData for registration verification
    for (const item of validRows) {
      try {
        await StudentPreData.findOneAndUpdate(
          { enrollment: item.enrollmentNo },
          {
            $set: {
              fullName: item.name,
              enrollment: item.enrollmentNo,
              batch: item.batch || '2022-2026',
              email: item.email,
              semester: item.semester,
              section: item.sectionName || 'A',
              department: 'CSE',
              phone: item.phone,
              source: 'MASTER_DATA'
            }
          },
          { upsert: true, new: true }
        );
      } catch (mErr) {
        logger.warn(`[Master Data Mongo Sync] Error: ${mErr.message}`);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdStudents.length} students into database.`,
      importedCount: createdStudents.length,
      skippedCount: errors.length,
      errors
    });
  } catch (error) {
    logger.error(`[Master Data] Import Students error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportStudents = async (req, res) => {
  try {
    const { semester, section } = req.query;
    const where = {};
    if (semester) where.semester = parseInt(semester, 10);
    if (section) where.section = { name: section.toUpperCase() };

    const students = await prisma.student.findMany({
      where,
      include: { department: true, section: true },
      orderBy: { enrollmentNo: 'asc' }
    });

    const data = students.map(s => ({
      'Enrollment Number': s.enrollmentNo,
      'Name': `${s.firstName} ${s.lastName || ''}`.trim(),
      'Email': s.email,
      'Phone': s.phone || '',
      'Semester': s.semester,
      'Section': s.section?.name || 'A',
      'Department': s.department?.code || 'CSE',
      'Status': s.status
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students_Roster');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students_master_data.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 3. SUBJECTS BULK IMPORT & EXPORT
// ----------------------------------------------------------------------------
exports.importSubjects = async (req, res) => {
  try {
    let rows = [];
    if (req.file) {
      rows = parseFileBuffer(req.file.buffer);
    } else if (Array.isArray(req.body.records) || Array.isArray(req.body.subjects)) {
      rows = req.body.records || req.body.subjects;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No subject rows found in uploaded data.' });
    }

    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;

    const [existingSubjects, defaultDept] = await Promise.all([
      prisma.subject.findMany({ select: { code: true } }),
      prisma.department.findFirst()
    ]);

    const existingCodes = new Set(existingSubjects.map(s => s.code.toUpperCase()));
    const fileCodes = new Set();

    const validRows = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const code = (row['Code'] || row['code'] || row['Subject Code'] || '').trim().toUpperCase();
      const name = (row['Name'] || row['name'] || row['Subject Name'] || '').trim();
      const semester = parseInt(row['Semester'] || row['semester'] || 5, 10);
      const credits = parseInt(row['Credits'] || row['credits'] || 4, 10);
      const weeklyHours = parseInt(row['Weekly Hours'] || row['weeklyHours'] || row['Periods'] || 4, 10);
      const isElective = String(row['isElective'] || row['Elective'] || '').toLowerCase() === 'true';

      if (!code) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Subject Code is required.` });
        continue;
      }
      if (!name) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Subject Name is required.` });
        continue;
      }
      if (existingCodes.has(code)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Subject Code '${code}' already exists in database.` });
        continue;
      }
      if (fileCodes.has(code)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate Subject Code '${code}' in uploaded file.` });
        continue;
      }

      fileCodes.add(code);
      validRows.push({
        rowNum,
        code,
        name,
        semester,
        credits,
        weeklyHours,
        isElective,
        departmentId: defaultDept?.id
      });
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        preview: validRows.slice(0, 10),
        errors
      });
    }

    const created = await prisma.$transaction(
      validRows.map(item =>
        prisma.subject.create({
          data: {
            code: item.code,
            name: item.name,
            semester: item.semester,
            credits: item.credits,
            weeklyHours: item.weeklyHours,
            isElective: item.isElective,
            departmentId: item.departmentId
          }
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${created.length} subjects into curriculum.`,
      importedCount: created.length,
      skippedCount: errors.length,
      errors
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportSubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { department: true },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }]
    });

    const data = subjects.map(s => ({
      'Subject Code': s.code,
      'Subject Name': s.name,
      'Semester': s.semester,
      'Credits': s.credits,
      'Weekly Hours': s.weeklyHours,
      'Is Elective': s.isElective ? 'Yes' : 'No',
      'Department': s.department?.code || 'CSE'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Subjects_Curriculum');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=subjects_curriculum.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 4. CLASSROOMS BULK IMPORT & EXPORT
// ----------------------------------------------------------------------------
exports.importClassrooms = async (req, res) => {
  try {
    let rows = [];
    if (req.file) {
      rows = parseFileBuffer(req.file.buffer);
    } else if (Array.isArray(req.body.records) || Array.isArray(req.body.classrooms)) {
      rows = req.body.records || req.body.classrooms;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No classroom rows found in uploaded data.' });
    }

    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;

    const [existingRooms, defaultDept] = await Promise.all([
      prisma.classroom.findMany({ select: { roomNumber: true } }),
      prisma.department.findFirst()
    ]);

    const existingRoomNums = new Set(existingRooms.map(r => r.roomNumber.toUpperCase()));
    const fileRoomNums = new Set();

    const validRows = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const roomNumber = (row['Room Number'] || row['roomNumber'] || row['Room'] || '').trim().toUpperCase();
      const type = (row['Type'] || row['type'] || row['Room Type'] || 'LECTURE_HALL').trim().toUpperCase();
      const capacity = parseInt(row['Capacity'] || row['capacity'] || 60, 10);
      const building = (row['Building'] || row['building'] || 'CSE Block').trim();
      const floor = parseInt(row['Floor'] || row['floor'] || 1, 10);

      if (!roomNumber) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Room Number is required.` });
        continue;
      }
      if (existingRoomNums.has(roomNumber)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Room Number '${roomNumber}' already exists.` });
        continue;
      }
      if (fileRoomNums.has(roomNumber)) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Duplicate Room Number '${roomNumber}' in file.` });
        continue;
      }

      fileRoomNums.add(roomNumber);
      validRows.push({
        rowNum,
        roomNumber,
        type: type.includes('LAB') ? 'LAB' : (type.includes('SEMINAR') ? 'SEMINAR_HALL' : 'LECTURE_HALL'),
        capacity,
        building,
        floor,
        departmentId: defaultDept?.id
      });
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        preview: validRows.slice(0, 10),
        errors
      });
    }

    const created = await prisma.$transaction(
      validRows.map(item =>
        prisma.classroom.create({
          data: {
            roomNumber: item.roomNumber,
            type: item.type,
            capacity: item.capacity,
            building: item.building,
            floor: item.floor,
            departmentId: item.departmentId,
            isActive: true
          }
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${created.length} classrooms/labs into database.`,
      importedCount: created.length,
      skippedCount: errors.length,
      errors
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportClassrooms = async (req, res) => {
  try {
    const rooms = await prisma.classroom.findMany({
      include: { department: true },
      orderBy: { roomNumber: 'asc' }
    });

    const data = rooms.map(r => ({
      'Room Number': r.roomNumber,
      'Room Type': r.type,
      'Capacity': r.capacity,
      'Building': r.building || 'CSE Block',
      'Floor': r.floor || 1,
      'Department': r.department?.code || 'CSE',
      'Is Active': r.isActive ? 'Yes' : 'No'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Classrooms_Labs');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=classrooms_master_data.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 5. TIMETABLE BULK IMPORT (Upload Excel Timetable directly to DB)
// ----------------------------------------------------------------------------
exports.importTimetable = async (req, res) => {
  try {
    let rows = [];
    if (req.file) {
      rows = parseFileBuffer(req.file.buffer);
    } else if (Array.isArray(req.body.records) || Array.isArray(req.body.slots)) {
      rows = req.body.records || req.body.slots;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No timetable rows found in uploaded file.' });
    }

    const {
      semester = 5,
      section = 'A',
      academicYear = '2026-27',
      replaceExisting = true,
      dryRun = false
    } = { ...req.query, ...req.body };

    const semNum = parseInt(semester, 10);
    const secName = section.toUpperCase();

    // Fetch database references
    const [dept, sec, allSubjects, allTeachers, allRooms] = await Promise.all([
      prisma.department.findFirst(),
      prisma.section.findFirst({ where: { name: secName } }),
      prisma.subject.findMany(),
      prisma.teacher.findMany(),
      prisma.classroom.findMany()
    ]);

    const errors = [];
    const validSlots = [];

    // Helper lookups
    const findSubject = (query) => {
      const q = String(query).toLowerCase().trim();
      return allSubjects.find(s => s.code.toLowerCase() === q || s.name.toLowerCase().includes(q));
    };

    const findTeacher = (query) => {
      const q = String(query).toLowerCase().trim();
      return allTeachers.find(t => {
        const full = `${t.firstName} ${t.lastName || ''}`.toLowerCase();
        return full.includes(q) || t.employeeId.toLowerCase() === q || t.email.toLowerCase() === q;
      });
    };

    const findRoom = (query) => {
      const q = String(query).toLowerCase().trim();
      return allRooms.find(r => r.roomNumber.toLowerCase() === q || r.roomNumber.toLowerCase().includes(q));
    };

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extract day
      const rawDay = (row['Day'] || row['day'] || row['Day of Week'] || '').trim();
      const matchedDay = DAYS.find(d => d.toLowerCase() === rawDay.toLowerCase());
      if (!matchedDay) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Invalid day of week '${rawDay}'. Must be Monday to Saturday.` });
        continue;
      }

      // Period & Times
      const periodNum = parseInt(row['Period'] || row['period'] || row['Period Number'] || 1, 10);
      let startTime = (row['Start Time'] || row['startTime'] || '').trim();
      let endTime = (row['End Time'] || row['endTime'] || '').trim();

      if (!startTime || !endTime) {
        const timeSlot = (row['Time Slot'] || row['Time'] || row['time'] || '').trim();
        if (timeSlot.includes('-')) {
          const parts = timeSlot.split('-');
          startTime = parts[0].trim();
          endTime = parts[1].trim();
        } else {
          startTime = '09:30 AM';
          endTime = '10:20 AM';
        }
      }

      // Subject
      const rawSubject = row['Subject'] || row['Subject Name'] || row['Subject Code'] || row['code'] || '';
      const matchedSub = findSubject(rawSubject);
      if (!matchedSub) {
        errors.push({ row: rowNum, error: `Row ${rowNum}: Unknown subject '${rawSubject}'. Ensure subject exists in curriculum first.` });
        continue;
      }

      // Teacher
      const rawTeacher = row['Faculty'] || row['Teacher'] || row['Faculty Member'] || row['teacher'] || '';
      const matchedTeacher = findTeacher(rawTeacher) || allTeachers[0];

      // Room
      const rawRoom = row['Room'] || row['Classroom'] || row['Room / Lab'] || row['room'] || '';
      const matchedRoom = findRoom(rawRoom) || allRooms[0] || null;

      const isLab = String(row['Type'] || row['isLab'] || '').toLowerCase().includes('lab') || matchedSub.name.toLowerCase().includes('lab');

      validSlots.push({
        rowNum,
        dayOfWeek: matchedDay,
        periodNumber: periodNum,
        startTime,
        endTime,
        subjectId: matchedSub.id,
        teacherId: matchedTeacher.id,
        classroomId: matchedRoom?.id || null,
        sectionId: sec?.id || null,
        isLab
      });
    }

    if (dryRun === true || req.query.dryRun === 'true') {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalRows: rows.length,
        validCount: validSlots.length,
        errorCount: errors.length,
        preview: validSlots.slice(0, 10),
        errors
      });
    }

    if (validSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid timetable rows could be parsed. Check errors below.',
        errors
      });
    }

    // Save to PostgreSQL Timetable
    const result = await prisma.$transaction(async (tx) => {
      // Find existing timetable or create new version
      let tb = await tx.timetable.findFirst({
        where: { departmentId: dept.id, semester: semNum, sectionId: sec?.id || undefined },
        orderBy: { version: 'desc' }
      });

      if (replaceExisting && tb) {
        // Remove existing slots
        await tx.timetableSlot.deleteMany({ where: { timetableId: tb.id } });
      } else {
        const nextVer = (tb?.version || 0) + 1;
        tb = await tx.timetable.create({
          data: {
            departmentId: dept.id,
            semester: semNum,
            sectionId: sec?.id || null,
            academicYear,
            version: nextVer,
            status: 'ACTIVE',
            approvedBy: req.user?.name || 'Admin / HOD File Import',
            approvedAt: new Date(),
            metrics: { importedFrom: 'Excel/CSV', slotsCount: validSlots.length }
          }
        });
      }

      // Insert new slots
      await tx.timetableSlot.createMany({
        data: validSlots.map(s => ({
          timetableId: tb.id,
          dayOfWeek: s.dayOfWeek,
          periodNumber: s.periodNumber,
          startTime: s.startTime,
          endTime: s.endTime,
          subjectId: s.subjectId,
          teacherId: s.teacherId,
          classroomId: s.classroomId,
          sectionId: sec?.id || null,
          isLab: s.isLab
        }))
      });

      return tb;
    });

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${validSlots.length} timetable slots into PostgreSQL.`,
      timetableId: result.id,
      importedCount: validSlots.length,
      errors
    });
  } catch (error) {
    logger.error(`[Master Data] Import Timetable error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 6. TIMETABLE EXPORT
// ----------------------------------------------------------------------------
exports.exportTimetable = async (req, res) => {
  try {
    const slots = await prisma.timetableSlot.findMany({
      include: {
        subject: true,
        teacher: true,
        classroom: true,
        section: true
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }]
    });

    const data = slots.map(s => ({
      'Day': s.dayOfWeek,
      'Period': s.periodNumber,
      'Start Time': s.startTime,
      'End Time': s.endTime,
      'Subject': s.subject ? `${s.subject.code} - ${s.subject.name}` : '',
      'Teacher': s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName || ''}`.trim() : '',
      'Room': s.classroom ? s.classroom.roomNumber : '',
      'Section': s.section ? s.section.name : 'A',
      'Type': s.isLab ? 'Lab' : 'Theory'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data.length > 0 ? data : [
      {
        'Day': 'Monday',
        'Period': 1,
        'Start Time': '09:30 AM',
        'End Time': '10:20 AM',
        'Subject': 'CS501',
        'Teacher': 'Dr. Rajesh Sharma',
        'Room': 'CR-301',
        'Section': 'A',
        'Type': 'Theory'
      }
    ]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Timetable_Schedule');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timetable_master_data.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------------
// 7. SAMPLE DATA TEMPLATE DOWNLOAD (.xlsx & .csv) FOR ALL MASTER DATA TYPES
// ----------------------------------------------------------------------------
exports.getSampleTemplate = async (req, res) => {
  try {
    const { type } = req.params;
    const format = (req.query.format || 'xlsx').toLowerCase();

    const sampleDatasets = {
      teachers: {
        sheetName: 'Teachers_Sample',
        filename: 'teachers_import_sample_template',
        data: [
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
        ]
      },
      students: {
        sheetName: 'Students_Sample',
        filename: 'students_import_sample_template',
        data: [
          {
            'Enrollment No': '0111CS211001',
            'Name': 'Aarav Sharma',
            'Email': 'aarav.sharma@student.oist.edu.in',
            'Semester': 5,
            'Section': 'A',
            'Phone': '9123456780'
          },
          {
            'Enrollment No': '0111CS211002',
            'Name': 'Diya Patel',
            'Email': 'diya.patel@student.oist.edu.in',
            'Semester': 5,
            'Section': 'A',
            'Phone': '9123456781'
          },
          {
            'Enrollment No': '0111CS211003',
            'Name': 'Rohan Gupta',
            'Email': 'rohan.gupta@student.oist.edu.in',
            'Semester': 5,
            'Section': 'B',
            'Phone': '9123456782'
          },
          {
            'Enrollment No': '0111CS211004',
            'Name': 'Ananya Singh',
            'Email': 'ananya.singh@student.oist.edu.in',
            'Semester': 6,
            'Section': 'A',
            'Phone': '9123456783'
          }
        ]
      },
      subjects: {
        sheetName: 'Subjects_Sample',
        filename: 'subjects_import_sample_template',
        data: [
          {
            'Code': 'CS501',
            'Name': 'Theory of Computation',
            'Semester': 5,
            'Credits': 4,
            'Weekly Hours': 4,
            'Is Elective': 'No'
          },
          {
            'Code': 'CS502',
            'Name': 'Database Management Systems',
            'Semester': 5,
            'Credits': 4,
            'Weekly Hours': 4,
            'Is Elective': 'No'
          },
          {
            'Code': 'CS503',
            'Name': 'Computer Networks',
            'Semester': 5,
            'Credits': 4,
            'Weekly Hours': 4,
            'Is Elective': 'No'
          },
          {
            'Code': 'CS504',
            'Name': 'Artificial Intelligence',
            'Semester': 5,
            'Credits': 3,
            'Weekly Hours': 3,
            'Is Elective': 'Yes'
          }
        ]
      },
      classrooms: {
        sheetName: 'Classrooms_Sample',
        filename: 'classrooms_import_sample_template',
        data: [
          {
            'Room Number': 'CR-301',
            'Type': 'LECTURE_HALL',
            'Capacity': 60,
            'Building': 'CSE Block',
            'Floor': 3
          },
          {
            'Room Number': 'CR-302',
            'Type': 'LECTURE_HALL',
            'Capacity': 60,
            'Building': 'CSE Block',
            'Floor': 3
          },
          {
            'Room Number': 'LAB-101',
            'Type': 'LAB',
            'Capacity': 40,
            'Building': 'CSE Block',
            'Floor': 1
          },
          {
            'Room Number': 'SEM-01',
            'Type': 'SEMINAR_HALL',
            'Capacity': 120,
            'Building': 'CSE Block',
            'Floor': 2
          }
        ]
      },
      timetables: {
        sheetName: 'Timetable_Sample',
        filename: 'timetable_import_sample_template',
        data: [
          {
            'Day': 'Monday',
            'Period': 1,
            'Start Time': '09:30 AM',
            'End Time': '10:20 AM',
            'Subject': 'CS501',
            'Teacher': 'Dr. Rajesh Sharma',
            'Room': 'CR-301',
            'Type': 'Theory'
          },
          {
            'Day': 'Monday',
            'Period': 2,
            'Start Time': '10:20 AM',
            'End Time': '11:10 AM',
            'Subject': 'CS502',
            'Teacher': 'Prof. Sunita Verma',
            'Room': 'CR-301',
            'Type': 'Theory'
          },
          {
            'Day': 'Tuesday',
            'Period': 1,
            'Start Time': '09:30 AM',
            'End Time': '10:20 AM',
            'Subject': 'CS503',
            'Teacher': 'Er. Amit Patel',
            'Room': 'CR-301',
            'Type': 'Theory'
          },
          {
            'Day': 'Wednesday',
            'Period': 3,
            'Start Time': '11:20 AM',
            'End Time': '01:00 PM',
            'Subject': 'CS502',
            'Teacher': 'Prof. Sunita Verma',
            'Room': 'LAB-101',
            'Type': 'Lab'
          }
        ]
      }
    };

    const normalizedType = type === 'timetable' ? 'timetables' : type;
    const dataset = sampleDatasets[normalizedType];

    if (!dataset) {
      return res.status(404).json({ success: false, message: `Sample template for '${type}' not found.` });
    }

    const worksheet = xlsx.utils.json_to_sheet(dataset.data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, dataset.sheetName);

    if (format === 'csv') {
      const csvBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'csv' });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${dataset.filename}.csv`);
      return res.send(csvBuffer);
    } else {
      const xlsxBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${dataset.filename}.xlsx`);
      return res.send(xlsxBuffer);
    }
  } catch (error) {
    logger.error(`[Master Data] Get Sample Template error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

