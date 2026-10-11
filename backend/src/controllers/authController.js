// ============================================================================
// Departmental ERP - Authoritative Authentication Controller
// Single Source of Truth: PostgreSQL
// ============================================================================

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/postgres');
const { StudentPreData } = require('../models/mongo');
const { getPermissionsForRole } = require('../config/permissions');
const { logger } = require('../services/loggerService');
const emailService = require('../services/emailService');

const { envConfig } = require('../config/env');
const JWT_SECRET = process.env.JWT_SECRET || envConfig.jwtSecret;
const ACCESS_TOKEN_EXPIRY = '7d';

// In-memory OTP store with 10-minute TTL: Map<email, { otp, expiresAt } >
const otpStore = new Map();

/**
 * Helper to build safe user representation for API clients
 */
const buildSafeUser = (user, effectiveRole) => {
  const isHod = (user.teacherProfile?.hodAssignments && user.teacherProfile.hodAssignments.length > 0) || effectiveRole === 'HOD';
  const isTg = Boolean(user.teacherProfile?.isTG);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    roleName: user.role?.name || effectiveRole,
    departmentId: user.departmentId,
    department: user.department ? {
      id: user.department.id,
      code: user.department.code,
      name: user.department.name
    } : null,
    studentId: user.studentProfile?.id || null,
    teacherId: user.teacherProfile?.id || null,
    isTG: isTg,
    isHOD: isHod,
    permissions: getPermissionsForRole(effectiveRole),
    studentProfile: user.studentProfile || null,
    teacherProfile: user.teacherProfile || null,
    createdAt: user.createdAt
  };
};

/**
 * Helper to sign JWT access token
 */
const signToken = (user, effectiveRole) => {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      role: effectiveRole
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// ----------------------------------------------------------------------------
// 1. Authoritative Login (PostgreSQL)
// ----------------------------------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Look up user strictly from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        role: true,
        department: true,
        studentProfile: {
          include: {
            section: true,
            tutorGuardian: true
          }
        },
        teacherProfile: {
          include: {
            hodAssignments: {
              where: { isCurrent: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account disabled. Please contact the administrator.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Determine authoritative role from verified profile data only.
    const baseRole = (user.role?.name || 'STUDENT').toUpperCase();
    const isHod = (user.teacherProfile?.hodAssignments && user.teacherProfile.hodAssignments.length > 0) || baseRole === 'HOD';
    const isTg = Boolean(user.teacherProfile?.isTG);

    let effectiveRole = baseRole;
    if (isHod) effectiveRole = 'HOD';
    else if (isTg && baseRole !== 'ADMIN') effectiveRole = 'TG';

    const token = signToken(user, effectiveRole);
    const safeUser = buildSafeUser(user, effectiveRole);

    logger.info(`[Auth Login] Successful authentication for ${cleanEmail} (Role: ${effectiveRole})`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      accessToken: token,
      user: safeUser
    });
  } catch (err) {
    logger.error(`[Auth Login Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

// ----------------------------------------------------------------------------
// 2. Authoritative Current User Profile (/api/auth/me)
// ----------------------------------------------------------------------------
exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }

    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (err) {
    logger.error(`[Auth GetMe Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
      code: 'SERVER_ERROR'
    });
  }
};

// ----------------------------------------------------------------------------
// 3. Student Registration (PostgreSQL Transaction)
// ----------------------------------------------------------------------------
exports.registerStudent = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      enrollmentNo,
      rollNo,
      semester = 5,
      departmentCode = 'CSE',
      sectionName = 'A',
      phone,
      dateOfBirth,
      admissionYear = 2023
    } = req.body;

    const finalEnrollment = (enrollmentNo || req.body.enrollment_no || rollNo || req.body.roll_no || `EN${Date.now().toString().slice(-6)}`).trim().toUpperCase();

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEnrollment = finalEnrollment;

    // Check uniqueness in PostgreSQL
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email ${cleanEmail} already exists. Please log in or reset your password.`,
        code: 'EMAIL_EXISTS'
      });
    }

    const existingStudent = await prisma.student.findUnique({ where: { enrollmentNo: cleanEnrollment } });
    if (existingStudent && existingStudent.userId) {
      return res.status(409).json({
        success: false,
        message: `An account for enrollment number ${cleanEnrollment} already exists in the system.`,
        code: 'ENROLLMENT_EXISTS'
      });
    }

    // Lookup Student Role
    const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    if (!studentRole) {
      return res.status(500).json({
        success: false,
        message: 'Student role definition missing in system database.',
        code: 'ROLE_MISSING'
      });
    }

    // Lookup Department
    let department = await prisma.department.findUnique({ where: { code: departmentCode.toUpperCase() } });
    if (!department) {
      department = await prisma.department.findFirst();
    }

    // Find section if specified
    let sectionId = null;
    if (department && sectionName) {
      const section = await prisma.section.findFirst({
        where: { departmentId: department.id, name: sectionName.toUpperCase() }
      });
      if (section) sectionId = section.id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Split name into first and last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Transactionally create/link User and Student in PostgreSQL (with generous 25s timeout for cloud DB)
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          roleId: studentRole.id,
          departmentId: department?.id || null,
          isActive: true
        }
      });

      // Find Tutor Guardian specifically assigned to this section
      let targetTgId = null;

      if (sectionId) {
        const secRecord = await tx.section.findUnique({
          where: { id: sectionId }
        });
        if (secRecord?.tgTeacherId) {
          targetTgId = secRecord.tgTeacherId;
        } else {
          // Check peer students in same section
          const peer = await tx.student.findFirst({
            where: { sectionId, tgTeacherId: { not: null } }
          });
          if (peer?.tgTeacherId) {
            targetTgId = peer.tgTeacherId;
          }
        }
      }

      // If no section TG on record, look for section by name with assigned TG
      if (!targetTgId && sectionName) {
        const secByName = await tx.section.findFirst({
          where: { name: sectionName.toUpperCase(), tgTeacherId: { not: null } }
        });
        if (secByName?.tgTeacherId) {
          targetTgId = secByName.tgTeacherId;
        }
      }

      // Fallback: active Tutor Guardian in department
      if (!targetTgId) {
        const activeTg = await tx.teacher.findFirst({
          where: {
            departmentId: department.id,
            isTG: true,
            status: 'ACTIVE'
          }
        }) || await tx.teacher.findFirst({
          where: { isTG: true, status: 'ACTIVE' }
        });
        if (activeTg) targetTgId = activeTg.id;
      }

      let studentRecord;
      if (existingStudent) {
        // Link and activate pre-loaded student row from Master Data roster
        studentRecord = await tx.student.update({
          where: { id: existingStudent.id },
          data: {
            userId: newUser.id,
            firstName,
            lastName,
            email: cleanEmail,
            phone: phone || existingStudent.phone || null,
            semester: parseInt(semester, 10) || existingStudent.semester || 5,
            departmentId: department.id,
            sectionId: sectionId || existingStudent.sectionId,
            tgTeacherId: targetTgId || existingStudent.tgTeacherId,
            status: 'ACTIVE'
          },
          include: {
            section: true,
            department: true,
            tutorGuardian: true
          }
        });
      } else {
        studentRecord = await tx.student.create({
          data: {
            userId: newUser.id,
            enrollmentNo: cleanEnrollment,
            rollNo: rollNo ? rollNo.trim() : null,
            firstName,
            lastName,
            email: cleanEmail,
            phone: phone || null,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            admissionYear: parseInt(admissionYear, 10) || 2023,
            semester: parseInt(semester, 10) || 5,
            departmentId: department.id,
            sectionId,
            tgTeacherId: targetTgId || null,
            status: 'ACTIVE'
          },
          include: {
            section: true,
            department: true,
            tutorGuardian: true
          }
        });
      }

      return { user: newUser, student: studentRecord };
    }, { timeout: 25000, maxWait: 15000 });

    // Mark student registered in MongoDB StudentPreData roster
    try {
      await StudentPreData.updateOne(
        { enrollment: cleanEnrollment },
        {
          $set: {
            isRegistered: true,
            registeredAt: new Date(),
            registeredUserId: String(result.user.id),
            email: cleanEmail,
            phone: phone || null
          }
        }
      );
    } catch (mErr) {
      logger.warn(`[Student PreData Update Warning]: ${mErr.message}`);
    }

    const token = signToken(result.user, 'STUDENT');
    const safeUser = buildSafeUser({
      ...result.user,
      role: studentRole,
      department,
      studentProfile: result.student
    }, 'STUDENT');

    logger.info(`[Auth Register] Student registered successfully: ${cleanEmail} (${cleanEnrollment})`);

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully.',
      token,
      accessToken: token,
      user: safeUser
    });
  } catch (err) {
    logger.error(`[Auth Register Student Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete student registration.',
      code: 'REGISTRATION_ERROR'
    });
  }
};

// ----------------------------------------------------------------------------
// 4. Teacher Registration (PostgreSQL Transaction)
// ----------------------------------------------------------------------------
exports.registerTeacher = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      employeeId,
      designation = 'Assistant Professor',
      departmentCode = 'CSE',
      phone,
      isTG = false
    } = req.body;

    const finalEmpId = (employeeId || req.body.employee_id || `EMP${Date.now().toString().slice(-6)}`).trim().toUpperCase();

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = finalEmpId;

    // Check uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email ${cleanEmail} already exists.`,
        code: 'EMAIL_EXISTS'
      });
    }

    const existingTeacher = await prisma.teacher.findUnique({ where: { employeeId: cleanEmpId } });
    if (existingTeacher) {
      return res.status(409).json({
        success: false,
        message: `A faculty member with Employee ID ${cleanEmpId} already exists.`,
        code: 'EMPLOYEE_ID_EXISTS'
      });
    }

    // Faculty registration is never permitted to self-appoint as TG.
    const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
    if (!teacherRole) {
      throw new Error('Teacher role definition missing in system database.');
    }

    // Department
    let department = await prisma.department.findUnique({ where: { code: departmentCode.toUpperCase() } });
    if (!department) {
      department = await prisma.department.findFirst();
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Teacher';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Transactionally create User and Teacher in PostgreSQL
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          roleId: teacherRole.id,
          departmentId: department?.id || null,
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
          designation: designation.trim(),
          departmentId: department.id,
          isTG: false, // SEC-06: Never permit self-appointment as TG. Appointed solely by HOD/ADMIN via /faculty/:id/appoint-tg
          status: 'ACTIVE'
        },
        include: {
          department: true
        }
      });

      return { user: newUser, teacher: newTeacher };
    }, { timeout: 25000, maxWait: 15000 });

    const effectiveRole = 'TEACHER'; // SEC-06: Registered faculty always start as TEACHER
    const token = signToken(result.user, effectiveRole);
    const safeUser = buildSafeUser({
      ...result.user,
      role: teacherRole,
      department,
      teacherProfile: result.teacher
    }, effectiveRole);

    logger.info(`[Auth Register] Teacher registered: ${cleanEmail} (${cleanEmpId})`);

    return res.status(201).json({
      success: true,
      message: 'Teacher account registered successfully.',
      token,
      accessToken: token,
      user: safeUser
    });
  } catch (err) {
    logger.error(`[Auth Register Teacher Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete teacher registration.',
      code: 'REGISTRATION_ERROR'
    });
  }
};

// ----------------------------------------------------------------------------
// 5. Admin Registration (PostgreSQL)
// ----------------------------------------------------------------------------
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, departmentCode = 'CSE', adminSecret } = req.body;

    // Required admin registration secret key with constant-time verification (SEC-07)
    const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET || envConfig.adminRegistrationSecret;
    if (!adminSecret) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Valid admin registration secret key is required.',
        code: 'INVALID_ADMIN_SECRET'
      });
    }

    const providedBuf = Buffer.from(String(adminSecret));
    const expectedBuf = Buffer.from(String(expectedSecret));
    const isMatch = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

    if (!isMatch) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Valid admin registration secret key is required.',
        code: 'INVALID_ADMIN_SECRET'
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in PostgreSQL
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email ${cleanEmail} already exists.`,
        code: 'EMAIL_EXISTS'
      });
    }

    // Lookup ADMIN role
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      return res.status(500).json({
        success: false,
        message: 'ADMIN role definition missing in system database.',
        code: 'ROLE_MISSING'
      });
    }

    // Lookup department if specified
    const department = await prisma.department.findFirst({
      where: { code: departmentCode.toUpperCase() }
    });

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        roleId: adminRole.id,
        departmentId: department?.id || null,
        isActive: true
      },
      include: {
        role: true,
        department: true
      }
    });

    const token = signToken(newUser, 'ADMIN');
    const safeUser = buildSafeUser(newUser, 'ADMIN');

    logger.info(`[Auth Register] Admin registered: ${cleanEmail}`);

    return res.status(201).json({
      success: true,
      message: 'Admin account registered successfully.',
      token,
      accessToken: token,
      user: safeUser
    });
  } catch (err) {
    logger.error(`[Auth Register Admin Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete admin registration.',
      code: 'REGISTRATION_ERROR'
    });
  }
};

// ----------------------------------------------------------------------------
// 6. Unified Register Endpoint (Delegates based on payload)
// ----------------------------------------------------------------------------
exports.register = async (req, res) => {
  const role = (req.body.role || '').toUpperCase();
  if (role === 'ADMIN') {
    return exports.registerAdmin(req, res);
  }
  if (role === 'TEACHER' || role === 'FACULTY' || role === 'TG' || req.body.employeeId) {
    return res.status(403).json({
      success: false,
      code: 'FACULTY_SELF_REGISTRATION_DISABLED',
      message: 'Faculty self-registration is disabled. Faculty accounts are appointed and provisioned exclusively by Department Administration via Master Data.'
    });
  }
  
  // Protect student registration with MongoDB StudentPreData verification
  const verifyStudentPreData = require('../middleware/verifyStudentPreData');
  return verifyStudentPreData(req, res, () => exports.registerStudent(req, res));
};

// ----------------------------------------------------------------------------
// 6. Refresh Token
// ----------------------------------------------------------------------------
exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub || decoded.id },
      include: { role: true, department: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid session.' });
    }

    const effectiveRole = (user.role?.name || 'STUDENT').toUpperCase();
    const newToken = signToken(user, effectiveRole);

    return res.status(200).json({
      success: true,
      token: newToken,
      accessToken: newToken
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

// ----------------------------------------------------------------------------
// 7. Forgot Password & OTP (Test S3 fix: Real OTP dispatch and verification)
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// 7. Forgot Password & OTP
// ----------------------------------------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    // Always return generic message to prevent account enumeration
    const genericSuccessMsg = 'If an account is associated with this email, a password reset code has been dispatched.';

    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericSuccessMsg
      });
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // ARCH-03: Persist hashed OTP token to PostgreSQL and clean up expired rows
    try {
      await prisma.passwordResetToken.deleteMany({
        where: { email: cleanEmail }
      });
      await prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      }).catch(() => {});

      await prisma.passwordResetToken.create({
        data: {
          email: cleanEmail,
          otpHash,
          expiresAt,
          attempts: 0
        }
      });
    } catch (dbErr) {
      logger.warn(`[ForgotPassword] DB token write warning: ${dbErr.message}`);
    }

    otpStore.set(cleanEmail, {
      otpHash,
      expiresAt: expiresAt.getTime(),
      attempts: 0
    });

    // Only log OTP to console in development environment
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[ForgotPassword] Dev OTP for ${cleanEmail}: ${otp}`);
    }

    // Send real email via emailService
    try {
      await emailService.sendOtpEmail(cleanEmail, otp, user.name);
    } catch (mailErr) {
      logger.error(`[ForgotPassword Email Error]: ${mailErr.message}`);
    }

    return res.status(200).json({
      success: true,
      message: genericSuccessMsg
    });
  } catch (err) {
    logger.error(`[ForgotPassword Error]: ${err.message}`);
    return res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // ARCH-03: Look up from persistent DB store first, fallback to memory
    let dbToken = null;
    try {
      dbToken = await prisma.passwordResetToken.findFirst({
        where: {
          email: cleanEmail,
          usedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (err) {
      logger.warn(`[VerifyOtp] DB lookup warning: ${err.message}`);
    }

    const memEntry = otpStore.get(cleanEmail);
    const effectiveToken = dbToken || (memEntry ? {
      otpHash: memEntry.otpHash,
      expiresAt: new Date(memEntry.expiresAt),
      attempts: memEntry.attempts
    } : null);

    if (!effectiveToken) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP request found for this email. Please request a new code.'
      });
    }

    if (Date.now() > new Date(effectiveToken.expiresAt).getTime()) {
      if (dbToken?.id) {
        await prisma.passwordResetToken.delete({ where: { id: dbToken.id } }).catch(() => {});
      }
      otpStore.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new code.'
      });
    }

    const currentAttempts = (effectiveToken.attempts || 0) + 1;
    if (dbToken?.id) {
      await prisma.passwordResetToken.update({
        where: { id: dbToken.id },
        data: { attempts: currentAttempts }
      }).catch(() => {});
    }
    if (memEntry) memEntry.attempts = currentAttempts;

    if (currentAttempts > 5) {
      if (dbToken?.id) {
        await prisma.passwordResetToken.delete({ where: { id: dbToken.id } }).catch(() => {});
      }
      otpStore.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. This OTP has been invalidated. Please request a new one.'
      });
    }

    const candidateHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    const isMatch = crypto.timingSafeEqual(Buffer.from(effectiveToken.otpHash, 'hex'), Buffer.from(candidateHash, 'hex'));

    if (!isMatch) {
      const remainingAttempts = 5 - currentAttempts;
      return res.status(400).json({
        success: false,
        message: remainingAttempts > 0 
          ? `Invalid OTP code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. This OTP has been invalidated. Please request a new one.'
      });
    }

    // Hash new password and update in PostgreSQL
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email: cleanEmail },
        data: { passwordHash }
      });
      await tx.passwordResetToken.updateMany({
        where: { email: cleanEmail },
        data: { usedAt: new Date() }
      });
    });

    // Invalidate cached auth user & delete OTP
    const { invalidateAuthUser } = require('../middleware/auth');
    invalidateAuthUser(cleanEmail);
    otpStore.delete(cleanEmail);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You may now login with your new password.'
    });
  } catch (err) {
    logger.error(`[VerifyOtp Error]: ${err.message}`);
    return res.status(500).json({ success: false, message: 'An error occurred while verifying OTP.' });
  }
};

// ----------------------------------------------------------------------------
// 8. Logout
// ----------------------------------------------------------------------------
exports.logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Successfully logged out.'
  });
};
