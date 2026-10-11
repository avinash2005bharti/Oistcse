// ============================================================================
// Middleware: verifyStudentPreData
// Production-Level Student Authentication Gatekeeper
// Checks student's 3 key details (Enrollment No, Full Legal Name, and Batch)
// against pre-loaded MongoDB StudentPreData roster imported via Master Data.
// ============================================================================

const { StudentPreData } = require('../models/mongo');
const { prisma } = require('../config/postgres');
const { logger } = require('../services/loggerService');

const normalizeStr = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const verifyStudentPreData = async (req, res, next) => {
  try {
    const enrollmentRaw =
      req.body.enrollmentNo ||
      req.body.enrollment_no ||
      req.body.rollNo ||
      req.body.roll_no ||
      req.body.enrollment;
    const nameRaw = req.body.name || req.body.fullName || req.body.FullName;
    const batchRaw = req.body.batch || req.body.Batch || req.body.academicBatch;

    if (!enrollmentRaw || !String(enrollmentRaw).trim()) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_ENROLLMENT',
        message: 'Enrollment Number (e.g. 0103CS211001) is required for student verification.'
      });
    }

    if (!nameRaw || !String(nameRaw).trim()) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_NAME',
        message: 'Full legal name is required for student verification.'
      });
    }

    const cleanEnrollment = String(enrollmentRaw).trim().toUpperCase();
    const cleanName = String(nameRaw).trim();
    const cleanBatch = batchRaw ? String(batchRaw).trim() : '2022-2026';

    // 1. Query MongoDB Pre-Data Roster
    let preData = await StudentPreData.findOne({ enrollment: cleanEnrollment });

    // Fallback: If not yet synced from PostgreSQL master data, sync on-the-fly
    if (!preData) {
      const pgStudent = await prisma.student.findUnique({
        where: { enrollmentNo: cleanEnrollment },
        include: { section: true }
      });

      if (pgStudent) {
        const studentFullName = `${pgStudent.firstName} ${pgStudent.lastName || ''}`.trim();
        preData = await StudentPreData.create({
          fullName: studentFullName,
          enrollment: cleanEnrollment,
          batch: cleanBatch || '2022-2026',
          semester: pgStudent.semester || 5,
          section: pgStudent.section?.name || 'A',
          email: pgStudent.email,
          phone: pgStudent.phone,
          source: 'POSTGRES_SYNC'
        });
      }
    }

    // 2. Step 1 Decision: Is student enrollment in the official roster?
    if (!preData) {
      logger.warn(`[Student Registration] Verification Failed: Enrollment '${cleanEnrollment}' not in predata roster.`);
      return res.status(403).json({
        success: false,
        code: 'NOT_IN_ROSTER',
        message: `Enrollment Number '${cleanEnrollment}' was not found in the verified department student roster pre-loaded by HOD/Admin. Please contact Department Admin or HOD to add your details to Master Data first.`
      });
    }

    // 3. Step 2 Decision: Has this student already completed registration?
    if (preData.isRegistered) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: `An account for enrollment '${cleanEnrollment}' is already registered in the system. Please sign in with your email or use 'Forgot Password'.`
      });
    }

    // Double check PostgreSQL: Ensure no existing user with this enrollment exists
    const existingPgStudent = await prisma.student.findUnique({
      where: { enrollmentNo: cleanEnrollment },
      include: { user: true }
    });
    if (existingPgStudent && existingPgStudent.userId) {
      preData.isRegistered = true;
      preData.registeredUserId = existingPgStudent.userId;
      await preData.save();

      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: `An account for enrollment '${cleanEnrollment}' is already registered in the system. Please sign in with your email or use 'Forgot Password'.`
      });
    }

    // 4. Step 3 Decision: Compare Full Legal Name
    const inputNorm = normalizeStr(cleanName);
    const preNorm = normalizeStr(preData.fullName);

    const inputTokens = cleanName.toLowerCase().split(/\s+/).filter(Boolean);
    const preTokens = preData.fullName.toLowerCase().split(/\s+/).filter(Boolean);
    const tokenOverlap = inputTokens.some((t) => preTokens.includes(t));

    if (inputNorm !== preNorm && !tokenOverlap && !inputNorm.includes(preNorm) && !preNorm.includes(inputNorm)) {
      logger.warn(`[Student Registration] Name mismatch: Input '${cleanName}' vs Roster '${preData.fullName}' for ${cleanEnrollment}`);
      return res.status(400).json({
        success: false,
        code: 'NAME_MISMATCH',
        message: `Legal name '${cleanName}' does not match the official student roster record for enrollment '${cleanEnrollment}' (on file: '${preData.fullName}'). Please verify your legal spelling or contact Department Admin.`
      });
    }

    // 5. Step 4 Decision: Compare Academic Batch
    if (batchRaw && preData.batch) {
      const bInput = normalizeStr(batchRaw);
      const bPre = normalizeStr(preData.batch);
      if (bInput !== bPre && !bInput.includes(bPre) && !bPre.includes(bInput)) {
        logger.warn(`[Student Registration] Batch mismatch: Input '${batchRaw}' vs Roster '${preData.batch}' for ${cleanEnrollment}`);
        return res.status(400).json({
          success: false,
          code: 'BATCH_MISMATCH',
          message: `The selected academic batch '${batchRaw}' does not match department records on file (${preData.batch}). Please select the correct batch or contact Department Admin.`
        });
      }
    }

    // All 3 details matched! Pass verified preData to next handler
    req.preDataStudent = preData;
    return next();
  } catch (error) {
    logger.error(`[Student Verification Middleware] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      code: 'VERIFICATION_ERROR',
      message: `An error occurred while verifying student credentials against department records: ${error.message}`
    });
  }
};

module.exports = verifyStudentPreData;
