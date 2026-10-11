// ============================================================================
// Service: studentPreDataSync
// Synchronizes PostgreSQL student records with MongoDB StudentPreData roster
// Ensures MongoDB predata cache is populated for fast verification at registration.
// ============================================================================

const { prisma } = require('../config/postgres');
const { StudentPreData } = require('../models/mongo');
const { logger } = require('./loggerService');

const syncExistingStudentsToMongo = async () => {
  try {
    const students = await prisma.student.findMany({
      include: {
        section: true,
        user: true
      }
    });

    if (!students || students.length === 0) {
      logger.info('[Student PreData Sync] No existing PostgreSQL students to synchronize.');
      return;
    }

    let synced = 0;
    for (const s of students) {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
      const enrollment = (s.enrollmentNo || '').toUpperCase();
      if (!enrollment) continue;

      const admissionYr = s.admissionYear || 2022;
      const batchStr = `${admissionYr}-${admissionYr + 4}`;
      const hasUser = Boolean(s.userId && s.user?.isActive);

      await StudentPreData.findOneAndUpdate(
        { enrollment },
        {
          $set: {
            fullName,
            enrollment,
            batch: batchStr,
            semester: s.semester || 5,
            section: s.section?.name || 'A',
            department: 'CSE',
            email: s.email,
            phone: s.phone || null,
            isRegistered: hasUser,
            registeredUserId: s.userId ? String(s.userId) : null,
            source: 'POSTGRES_SYNC'
          }
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    logger.info(`[Student PreData Sync] Successfully synced ${synced} students into MongoDB StudentPreData roster.`);
  } catch (err) {
    logger.warn(`[Student PreData Sync] Warning during synchronization: ${err.message}`);
  }
};

module.exports = { syncExistingStudentsToMongo };
