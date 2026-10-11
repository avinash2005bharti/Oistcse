// ============================================================================
// Departmental ERP - Faculty & Teacher Controller
// Canonical Source of Truth: PostgreSQL via Prisma
// ============================================================================

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/postgres');
const { logger } = require('../services/loggerService');

// Format teacher record helper
const formatTeacher = (t) => {
  const isHod = (t.hodAssignments && t.hodAssignments.length > 0) || (t.user?.role?.name === 'HOD');
  const isTg = t.isTG || (t.user?.role?.name === 'TG') || Boolean(t.tgSections?.length);
  const assignedSection = t.tgSections?.[0];
  const name = `${t.firstName} ${t.lastName || ''}`.trim();

  return {
    ...t,
    name,
    isTG: isTg,
    isTg,
    isHOD: isHod,
    role: isHod ? 'hod' : 'teacher',
    tgSection: assignedSection
      ? `Semester ${assignedSection.semester?.semesterNumber || '—'} • Section ${assignedSection.name}`
      : null,
    tgSectionId: assignedSection?.id || null,
    tgSemester: assignedSection?.semester?.semesterNumber || null,
    departmentName: t.department?.name || 'Computer Science & Engineering',
    departmentCode: t.department?.code || 'CSE'
  };
};

// 1. Get All Faculty
exports.getFaculty = async (req, res) => {
  try {
    const { search, designation } = req.query;
    const where = {};

    if (designation) where.designation = designation;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true } },
        hodAssignments: { where: { isCurrent: true } },
        tgSections: { include: { semester: true }, orderBy: { name: 'asc' } }
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    const formattedList = teachers.map(formatTeacher);

    return res.status(200).json({
      success: true,
      count: formattedList.length,
      faculty: formattedList,
      data: formattedList
    });
  } catch (error) {
    logger.error(`[Faculty Controller] Error fetching faculty: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Single Faculty Member
exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { id: id.length === 36 ? id : undefined },
          { employeeId: id.toUpperCase() },
          { email: id.toLowerCase() }
        ].filter(Boolean)
      },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true } },
        hodAssignments: { where: { isCurrent: true } },
        tgSections: { include: { semester: true }, orderBy: { name: 'asc' } },
        teacherSubjects: { include: { subject: true, section: true } }
      }
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Faculty member not found in ERP records.' });
    }

    return res.status(200).json({ success: true, faculty: formatTeacher(teacher), data: formatTeacher(teacher) });
  } catch (error) {
    logger.error(`[Faculty Controller] Error fetching faculty ${req.params.id}: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create Faculty
exports.createFaculty = async (req, res) => {
  try {
    const { name, email, employeeId, designation = 'Assistant Professor', phone, isTG = false, departmentCode = 'CSE' } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = (employeeId || `EMP${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();

    const existing = await prisma.teacher.findFirst({
      where: { OR: [{ email: cleanEmail }, { employeeId: cleanEmpId }] }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Teacher with this email or employee ID already exists.' });
    }

    const defaultDept = await prisma.department.findFirst();
    const teacherRole = await prisma.role.findFirst({ where: { name: isTG ? 'TG' : 'TEACHER' } });

    const passwordHash = await bcrypt.hash('Teacher@123', 10);
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || 'Teacher';
    const lastName = parts.slice(1).join(' ') || '';

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          roleId: teacherRole.id,
          departmentId: defaultDept.id,
          isActive: true
        }
      });

      const newTeacher = await tx.teacher.create({
        data: {
          userId: newUser.id,
          employeeId: cleanEmpId,
          firstName,
          lastName,
          email: cleanEmail,
          phone: phone || null,
          designation,
          departmentId: defaultDept.id,
          isTG: Boolean(isTG),
          status: 'ACTIVE'
        },
        include: {
          department: true
        }
      });

      return newTeacher;
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty member created successfully.',
      faculty: formatTeacher(result)
    });
  } catch (error) {
    logger.error(`[Faculty Controller] Error creating faculty: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update Faculty Member
exports.updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const isHod = requesterRole === 'HOD';
    const isAdmin = requesterRole === 'ADMIN';

    const {
      name,
      email,
      phone,
      designation,
      specialization,
      status,
      isTG,
      employeeId,
      employee_id,
      maxPeriodsPerDay,
      maxPeriodsPerWeek,
      password
    } = req.body;

    // Security check: HOD cannot edit passwords
    if (isHod && password && password.trim()) {
      return res.status(403).json({
        success: false,
        message: 'Security policy violation: HOD is not permitted to edit passwords. Password updates are strictly restricted to System Administrator.'
      });
    }

    const existingTeacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!existingTeacher) {
      return res.status(404).json({ success: false, message: 'Teacher record not found.' });
    }

    const data = {};
    if (phone !== undefined) data.phone = phone || null;
    if (designation !== undefined) data.designation = designation;
    if (specialization !== undefined) data.specialization = specialization;
    if (status !== undefined) data.status = status;
    if (isTG !== undefined) data.isTG = Boolean(isTG);
    if (employeeId || employee_id) data.employeeId = (employeeId || employee_id).trim().toUpperCase();
    if (maxPeriodsPerDay) data.maxPeriodsPerDay = parseInt(maxPeriodsPerDay, 10);
    if (maxPeriodsPerWeek) data.maxPeriodsPerWeek = parseInt(maxPeriodsPerWeek, 10);

    let fullName = name ? name.trim() : null;
    if (name) {
      const parts = name.trim().split(/\s+/);
      data.firstName = parts[0];
      data.lastName = parts.slice(1).join(' ');
    }

    if (email && email.trim()) {
      data.email = email.trim().toLowerCase();
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update teacher table
      const updatedTeacher = await tx.teacher.update({
        where: { id },
        data,
        include: {
          department: true,
          user: true,
          hodAssignments: { where: { isCurrent: true } }
        }
      });

      // Synchronize linked User account if it exists
      if (existingTeacher.userId) {
        const userUpdateData = {};
        if (fullName) userUpdateData.name = fullName;
        if (data.email) userUpdateData.email = data.email;
        if (status) userUpdateData.isActive = status.toUpperCase() === 'ACTIVE';

        // Admin can update password
        if (isAdmin && password && password.trim()) {
          userUpdateData.passwordHash = await bcrypt.hash(password.trim(), 10);
        }

        // Update role if isTG changed
        if (isTG !== undefined) {
          const targetRoleName = isTG ? 'TG' : 'TEACHER';
          const targetRole = await tx.role.findFirst({
            where: { name: { equals: targetRoleName, mode: 'insensitive' } }
          });
          if (targetRole) {
            userUpdateData.roleId = targetRole.id;
          }
        }

        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: existingTeacher.userId },
            data: userUpdateData
          });
        }
      }

      return updatedTeacher;
    });

    return res.status(200).json({
      success: true,
      message: 'Faculty profile updated successfully.',
      faculty: formatTeacher(updated)
    });
  } catch (error) {
    logger.error(`[Faculty Controller] Error updating faculty ${req.params.id}: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Appoint as Tutor Guardian (TG)
exports.appointTg = async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, section, sectionName, semester, academicYear } = req.body;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true, department: true }
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher record not found.' });
    }

    const targetSectionName = (section || sectionName || '').trim().toUpperCase();
    const targetSemesterNum = semester ? Number(semester) : null;
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let targetSection = null;

    // 1. Try finding by valid UUID sectionId
    if (sectionId && isUuid(sectionId)) {
      targetSection = await prisma.section.findFirst({
        where: { id: sectionId, departmentId: teacher.departmentId },
        include: { semester: true }
      });
    }

    // 2. If not found or no valid sectionId, find by semester number & section name
    if (!targetSection && targetSectionName) {
      if (targetSemesterNum) {
        targetSection = await prisma.section.findFirst({
          where: {
            departmentId: teacher.departmentId,
            name: targetSectionName,
            semester: { semesterNumber: targetSemesterNum }
          },
          include: { semester: true }
        });
      }

      // If still not found, search by name only within the department
      if (!targetSection) {
        targetSection = await prisma.section.findFirst({
          where: {
            departmentId: teacher.departmentId,
            name: targetSectionName
          },
          include: { semester: true }
        });
      }
    }

    // 3. If section still doesn't exist, create semester & section on-the-fly
    if (!targetSection && targetSectionName) {
      const semNum = targetSemesterNum || 5;
      const year = academicYear || '2026-27';

      let semRecord = await prisma.semester.findFirst({
        where: {
          departmentId: teacher.departmentId,
          semesterNumber: semNum
        }
      });

      if (!semRecord) {
        semRecord = await prisma.semester.create({
          data: {
            departmentId: teacher.departmentId,
            semesterNumber: semNum,
            academicYear: year
          }
        });
      }

      targetSection = await prisma.section.create({
        data: {
          name: targetSectionName,
          semesterId: semRecord.id,
          departmentId: teacher.departmentId,
          academicYear: year,
          capacity: 60
        },
        include: { semester: true }
      });
    }

    if (!targetSection) {
      return res.status(400).json({ success: false, message: 'A semester-specific section is required.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const previousSections = await tx.section.findMany({
        where: { tgTeacherId: id, id: { not: targetSection.id } },
        select: { id: true }
      });
      const previousSectionIds = previousSections.map((assigned) => assigned.id);

      if (previousSectionIds.length > 0) {
        await tx.section.updateMany({
          where: { id: { in: previousSectionIds }, tgTeacherId: id },
          data: { tgTeacherId: null }
        });
        await tx.student.updateMany({
          where: { sectionId: { in: previousSectionIds }, tgTeacherId: id },
          data: { tgTeacherId: null }
        });
      }

      await tx.section.update({
        where: { id: targetSection.id },
        data: { tgTeacherId: id }
      });
      await tx.student.updateMany({
        where: { sectionId: targetSection.id },
        data: { tgTeacherId: id }
      });
      await tx.teacher.update({
        where: { id },
        data: { isTG: true }
      });

      if (teacher.userId) {
        const tgRole = await tx.role.findFirst({ where: { name: { equals: 'TG', mode: 'insensitive' } } });
        if (tgRole) {
          await tx.user.update({
            where: { id: teacher.userId },
            data: { roleId: tgRole.id }
          });
        }
      }

      return tx.teacher.findUnique({
        where: { id },
        include: {
          department: true,
          user: { select: { id: true, email: true, role: true } },
          hodAssignments: { where: { isCurrent: true } },
          tgSections: { include: { semester: true }, orderBy: { name: 'asc' } }
        }
      });
    });

    const { invalidateAuthUser } = require('../middleware/auth');
    if (updated?.userId) invalidateAuthUser(updated.userId);

    return res.status(200).json({
      success: true,
      message: `Teacher appointed as Tutor Guardian (TG) for Semester ${targetSection.semester?.semesterNumber || '—'}, Section ${targetSection.name}.`,
      faculty: formatTeacher(updated)
    });
  } catch (error) {
    logger.error('Error appointing TG:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Remove TG Status
exports.removeTg = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true, department: true }
    });

    const updated = await prisma.teacher.update({
      where: { id },
      data: { isTG: false },
      include: { department: true }
    });

    if (teacher?.userId) {
      const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
      if (teacherRole) {
        await prisma.user.update({
          where: { id: teacher.userId },
          data: { roleId: teacherRole.id }
        });
      }
    }

    // Unlink from sections and students
    await prisma.section.updateMany({
      where: { tgTeacherId: id },
      data: { tgTeacherId: null }
    });

    await prisma.student.updateMany({
      where: { tgTeacherId: id },
      data: { tgTeacherId: null }
    });

    const { invalidateAuthUser } = require('../middleware/auth');
    if (teacher?.userId) invalidateAuthUser(teacher.userId);

    return res.status(200).json({
      success: true,
      message: 'TG appointment revoked.',
      faculty: formatTeacher(updated)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.revokeTg = exports.removeTg;

// 7. Delete Faculty
exports.deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      // 1. Unlink any students where this teacher is TG
      await tx.student.updateMany({
        where: { tgTeacherId: id },
        data: { tgTeacherId: null }
      });

      // 2. Unlink or remove teacher subjects
      await tx.teacherSubject.deleteMany({ where: { teacherId: id } });

      // 3. Clear timetable slots
      await tx.timetableSlot.deleteMany({ where: { teacherId: id } });

      // 4. Remove leave applications
      await tx.leaveApplication.deleteMany({ where: { teacherId: id } });

      // 5. Remove HOD assignment if exists
      await tx.hOD.deleteMany({ where: { teacherId: id } });

      // 6. Delete teacher record
      const teacher = await tx.teacher.delete({ where: { id } });

      // 7. Delete associated user if exists
      if (teacher.userId) {
        await tx.user.delete({ where: { id: teacher.userId } }).catch(() => {});
      }
    });

    return res.status(200).json({ success: true, message: 'Faculty member deleted successfully.' });
  } catch (error) {
    logger.error(`[Faculty Controller] Error deleting faculty ${req.params.id}: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
