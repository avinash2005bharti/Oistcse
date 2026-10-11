// ============================================================================
// PostgreSQL Prisma Teacher Service
// Single Source of Truth for Faculty, TG Appointments, and Teacher Data
// ============================================================================

const { prisma } = require('../../config/postgres');

class PostgresTeacherService {
  async getAll({ departmentId, search, designation } = {}) {
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (designation) where.designation = designation;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, email: true, role: true } },
        mentorGroups: true,
        hod: { where: { isCurrent: true } }
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    return teachers.map(t => {
      const isTG = Boolean(
        (t.designation || '').toLowerCase().includes('(tg)') ||
        (t.designation || '').toLowerCase().includes('tg') ||
        (t.user?.role || '').toLowerCase() === 'tg' ||
        (t.mentorGroups && t.mentorGroups.length > 0)
      );

      let tgSection = null;
      if (t.mentorGroups && t.mentorGroups.length > 0) {
        const mgName = t.mentorGroups[0].name || '';
        const match = mgName.match(/Section\s*([A-Za-z0-9-]+)/i);
        tgSection = match ? match[1] : 'A';
      } else if (isTG) {
        tgSection = 'A';
      }

      const isHOD = t.hod && t.hod.length > 0;

      return {
        ...t,
        name: `${t.firstName} ${t.lastName || ''}`.trim(),
        isTG,
        isTg: isTG,
        tgSection,
        isHOD,
        role: isTG ? 'tg' : (isHOD ? 'hod' : (t.user?.role || 'faculty'))
      };
    });
  }

  async getById(id) {
    if (!id) return null;
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true } },
        mentorGroups: true,
        subjectAssignments: { include: { subject: true, section: true } },
        hod: { where: { isCurrent: true } }
      }
    });

    if (!teacher) return null;
    const isTG = Boolean(
      (teacher.designation || '').toLowerCase().includes('(tg)') ||
      (teacher.user?.role || '').toLowerCase() === 'tg' ||
      (teacher.mentorGroups && teacher.mentorGroups.length > 0)
    );

    return {
      ...teacher,
      name: `${teacher.firstName} ${teacher.lastName || ''}`.trim(),
      isTG,
      isTg: isTG
    };
  }

  async getByEmail(email) {
    if (!email) return null;
    return prisma.teacher.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { department: true, user: true, mentorGroups: true }
    });
  }

  async appointTG(teacherId, { section = 'A', academicYear = '2026-27' }) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true }
    });

    if (!teacher) {
      throw new Error('Teacher record not found.');
    }

    // 1. Update designation
    const baseDesignation = teacher.designation ? teacher.designation.replace(/\s*\(TG\)/gi, '').trim() : 'Assistant Professor';
    const newDesignation = `${baseDesignation} (TG)`;

    await prisma.teacher.update({
      where: { id: teacherId },
      data: { designation: newDesignation }
    });

    // 2. Update linked User role to TG
    if (teacher.userId) {
      await prisma.user.update({
        where: { id: teacher.userId },
        data: { role: 'TG' }
      });
    }

    // 3. Create or update MentorGroup (if model exists)
    let mentorGroup = null;
    if (prisma.mentorGroup) {
      try {
        const existingGroup = await prisma.mentorGroup.findFirst({
          where: { teacherId }
        });

        const teacherFullName = `${teacher.firstName} ${teacher.lastName || ''}`.trim();

        if (!existingGroup) {
          mentorGroup = await prisma.mentorGroup.create({
            data: {
              teacherId,
              name: `TG Group - Section ${section} (${teacherFullName})`,
              departmentId: teacher.departmentId,
              academicYear
            }
          });
        } else {
          mentorGroup = await prisma.mentorGroup.update({
            where: { id: existingGroup.id },
            data: {
              name: `TG Group - Section ${section} (${teacherFullName})`,
              academicYear
            }
          });
        }
      } catch (mgErr) {
        // Safe to ignore legacy mentorGroup errors
      }
    }

    // 4. Create Notification
    try {
      await prisma.notification.create({
        data: {
          recipientUserId: teacher.userId || teacher.id,
          role: 'tg',
          title: 'Appointed as Tutor Guardian (TG)',
          message: `You have been officially appointed as Tutor Guardian (TG) for Section ${section} by HOD Office.`,
          type: 'info'
        }
      });
    } catch (e) {}

    return {
      teacher: {
        ...teacher,
        designation: newDesignation,
        isTG: true,
        tgSection: section
      },
      mentorGroup
    };
  }

  async revokeTG(teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true }
    });

    if (!teacher) {
      throw new Error('Teacher not found.');
    }

    const cleanDesignation = teacher.designation ? teacher.designation.replace(/\s*\(TG\)/gi, '').trim() : 'Assistant Professor';

    await prisma.teacher.update({
      where: { id: teacherId },
      data: { designation: cleanDesignation }
    });

    if (teacher.userId) {
      await prisma.user.update({
        where: { id: teacher.userId },
        data: { role: 'faculty' }
      });
    }

    if (prisma.mentorGroup) {
      await prisma.mentorGroup.deleteMany({
        where: { teacherId }
      });
    }

    return {
      teacher: {
        ...teacher,
        designation: cleanDesignation,
        isTG: false,
        tgSection: null
      }
    };
  }

  async getHOD(departmentId) {
    const hod = await prisma.hOD.findFirst({
      where: { departmentId, isCurrent: true },
      include: {
        teacher: {
          include: { department: true }
        }
      }
    });

    if (!hod) return null;
    return {
      ...hod.teacher,
      name: `${hod.teacher.firstName} ${hod.teacher.lastName || ''}`.trim()
    };
  }
}

module.exports = new PostgresTeacherService();
