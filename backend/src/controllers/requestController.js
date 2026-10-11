// ============================================================================
// Departmental ERP - Request Controller (Leaves & Attendance Workflows)
// Canonical Source of Truth: PostgreSQL via Prisma
// ============================================================================

const { prisma } = require('../config/postgres');
const { logger } = require('../services/loggerService');
const { emitNotification } = require('../sockets/socketHandler');
const googleSheetSyncService = require('../services/googleSheetSyncService');

// Helper: Dispatch in-app notification & emit socket event
const sendNotification = async ({ userId, recipientRole, title, message, type = 'INFO', linkUrl }) => {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: userId || null,
        recipientRole: (recipientRole || 'ALL').toUpperCase(),
        title,
        message,
        type: (type || 'INFO').toUpperCase(),
        linkUrl: linkUrl || null,
        isRead: false
      }
    });

    try {
      emitNotification((recipientRole || 'all').toLowerCase(), {
        ...notif,
        read: false,
        recipient: notif.recipientRole
      });
    } catch (e) {
      // socket failure should not break HTTP transaction
    }

    return notif;
  } catch (err) {
    logger.warn(`[sendNotification] Failed: ${err.message}`);
  }
};

// Helper: Ensure student has an assigned Tutor Guardian
const ensureStudentHasTg = async (studentId) => {
  if (!studentId) return;
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { section: true }
    });

    if (student && !student.tgTeacherId) {
      let activeTg = null;
      // 1. Check if section has an assigned TG
      if (student.section?.tgTeacherId) {
        activeTg = await prisma.teacher.findUnique({
          where: { id: student.section.tgTeacherId }
        });
      }
      // 2. Check if another student in this section has a TG
      if (!activeTg && student.sectionId) {
        const peer = await prisma.student.findFirst({
          where: { sectionId: student.sectionId, tgTeacherId: { not: null } }
        });
        if (peer?.tgTeacherId) {
          activeTg = await prisma.teacher.findUnique({ where: { id: peer.tgTeacherId } });
        }
      }
      // 3. Fallback to active department TG
      if (!activeTg) {
        activeTg = await prisma.teacher.findFirst({
          where: { isTG: true, status: 'ACTIVE', departmentId: student.departmentId }
        }) || await prisma.teacher.findFirst({
          where: { isTG: true, status: 'ACTIVE' }
        });
      }

      if (activeTg) {
        await prisma.student.update({
          where: { id: studentId },
          data: { tgTeacherId: activeTg.id }
        });
      }
    }
  } catch (err) {
    logger.warn(`[ensureStudentHasTg] Failed: ${err.message}`);
  }
};

// 1. Get All Requests (Role-Aware Scoping)
exports.getAllRequests = async (req, res) => {
  try {
    const userRole = (req.user?.role || req.user?.roleName || '').toUpperCase();
    let { studentId, status } = req.query;

    let studentFilter = {};

    if (userRole === 'STUDENT') {
      // Students can ONLY view their own requests
      const callerStudentId = req.user?.studentId;
      if (!callerStudentId) {
        return res.status(200).json({
          success: true,
          total: 0,
          requests: [],
          attendanceRequests: [],
          considerationRequests: [],
          attendanceQueries: [],
          correctionRequests: [],
          leaveRequests: []
        });
      }
      studentFilter = { studentId: callerStudentId };
    } else if (userRole === 'TG' && !req.user?.isHOD && userRole !== 'ADMIN') {
      // Tutor Guardian sees ONLY their mentees' requests
      const tgTeacherId = req.user?.teacherId;
      if (!tgTeacherId) {
        studentFilter = { student: { tgTeacherId: '00000000-0000-0000-0000-000000000000' } };
      } else {
        studentFilter = {
          student: {
            OR: [
              { tgTeacherId },
              { section: { tgTeacherId } }
            ]
          }
        };
      }
    } else if (req.query.studentId) {
      studentFilter = { studentId: req.query.studentId };
    }

    const { semester, section } = req.query;

    const extraStudentCriteria = {};
    if (semester && semester !== 'ALL') {
      extraStudentCriteria.semester = parseInt(semester, 10);
    }
    if (section && section !== 'ALL') {
      extraStudentCriteria.section = { name: section.toUpperCase() };
    }

    if (Object.keys(extraStudentCriteria).length > 0) {
      studentFilter = {
        ...studentFilter,
        student: {
          ...(studentFilter.student || {}),
          ...extraStudentCriteria
        }
      };
    }

    const [considerations, corrections, leaves] = await Promise.all([
      prisma.attendanceConsiderationRequest.findMany({
        where: {
          ...studentFilter,
          ...(status ? { status } : {})
        },
        include: {
          student: { include: { section: true, department: true, tutorGuardian: true } },
          subject: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.attendanceCorrectionRequest.findMany({
        where: {
          ...studentFilter,
          ...(status ? { status } : {})
        },
        include: {
          student: { include: { section: true, department: true, tutorGuardian: true } },
          subject: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.leaveApplication.findMany({
        where: {
          ...studentFilter,
          ...(status ? { status } : {})
        },
        include: {
          student: { include: { section: true, department: true, tutorGuardian: true } },
          teacher: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const formatConsideration = (c) => {
      let periodsObj = c.periods;
      if (typeof periodsObj === 'string') {
        try {
          periodsObj = JSON.parse(periodsObj);
        } catch (_) {}
      }
      const periodsCount = periodsObj?.periodsCount || (Array.isArray(periodsObj?.selectedPeriods) ? periodsObj.selectedPeriods.length : (Array.isArray(periodsObj) ? periodsObj.length : undefined));
      const selectedPeriods = periodsObj?.selectedPeriods || (Array.isArray(periodsObj) ? periodsObj : undefined);
      const periodsTiming = periodsObj?.periodsTiming || (Array.isArray(periodsObj) ? periodsObj.map(p => p.time || p.label || p).join(', ') : undefined);

      return {
        id: c.id,
        type: 'attendance_consideration',
        category: c.category || 'Academic Consideration',
        title: `OD Consideration: ${c.category || 'Academic'}`,
        studentId: c.studentId,
        studentName: c.student ? `${c.student.firstName} ${c.student.lastName || ''}`.trim() : 'Student',
        rollNo: c.student?.rollNo || c.student?.enrollmentNo || 'CSE-001',
        enrollmentNo: c.student?.enrollmentNo || c.student?.rollNo || 'CSE-001',
        section: c.student?.section?.name || 'A',
        semester: c.student?.semester || 5,
        department: c.student?.department?.code || 'CSE',
        subjectName: c.subject?.name || 'All Subjects',
        subjectCode: c.subject?.code || '',
        dates: `${new Date(c.startDate).toLocaleDateString()} - ${new Date(c.endDate).toLocaleDateString()}`,
        dateRangeLabel: `${new Date(c.startDate).toLocaleDateString()} - ${new Date(c.endDate).toLocaleDateString()}`,
        startDate: c.startDate,
        endDate: c.endDate,
        reason: c.reason,
        status: c.status,
        proofDocumentUrl: c.proofDocumentUrl,
        docUrl: c.proofDocumentUrl,
        supportingDoc: c.proofDocumentUrl,
        periods: c.periods || null,
        periodsCount: periodsCount,
        selectedPeriods: selectedPeriods,
        periodsTiming: periodsTiming,
        tgRemarks: c.tgRemarks,
        hodRemarks: c.hodRemarks,
        tgRecommendation: c.tgRemarks,
        recommendedAt: c.recommendedAt,
        approvedAt: c.approvedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    };

    const formatCorrection = (q) => ({
      id: q.id,
      type: 'attendance_query',
      title: `Attendance Query: ${q.subject?.name || 'Dispute'}`,
      studentId: q.studentId,
      studentName: q.student ? `${q.student.firstName} ${q.student.lastName || ''}`.trim() : 'Student',
      rollNo: q.student?.rollNo || q.student?.enrollmentNo || 'CSE-001',
      enrollmentNo: q.student?.enrollmentNo || q.student?.rollNo || 'CSE-001',
      section: q.student?.section?.name || 'A',
      semester: q.student?.semester || 5,
      department: q.student?.department?.code || 'CSE',
      subjectName: q.subject?.name || 'Lecture',
      subjectCode: q.subject?.code || '',
      dates: new Date(q.date).toLocaleDateString(),
      dateRangeLabel: new Date(q.date).toLocaleDateString(),
      date: q.date,
      reason: q.reason,
      status: q.status,
      proofDocumentUrl: q.supportingDocUrl,
      docUrl: q.supportingDocUrl,
      supportingDoc: q.supportingDocUrl,
      reviewNote: q.reviewNote || q.tgRemarks,
      tgRemarks: q.tgRemarks || q.reviewNote,
      tgRecommendation: q.tgRemarks || q.reviewNote,
      hodRemarks: q.hodRemarks,
      recommendedAt: q.recommendedAt,
      approvedAt: q.approvedAt,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt
    });

    const formatLeave = (l) => ({
      id: l.id,
      type: 'leave_request',
      applicantType: l.applicantType,
      title: `Leave: ${l.leaveType || 'Application'}`,
      studentId: l.studentId,
      studentName: l.student ? `${l.student.firstName} ${l.student.lastName || ''}`.trim() : (l.teacher ? `${l.teacher.firstName} ${l.teacher.lastName || ''}`.trim() : 'Applicant'),
      rollNo: l.student?.rollNo || l.student?.enrollmentNo || (l.teacher?.employeeId || 'FAC-001'),
      enrollmentNo: l.student?.enrollmentNo || l.student?.rollNo || '',
      section: l.student?.section?.name || 'A',
      semester: l.student?.semester || 5,
      department: l.student?.department?.code || 'CSE',
      teacherName: l.teacher ? `${l.teacher.firstName} ${l.teacher.lastName || ''}`.trim() : null,
      leaveType: l.leaveType,
      category: l.leaveType,
      totalDays: l.totalDays,
      dates: `${new Date(l.startDate).toLocaleDateString()} - ${new Date(l.endDate).toLocaleDateString()}`,
      dateRangeLabel: `${new Date(l.startDate).toLocaleDateString()} - ${new Date(l.endDate).toLocaleDateString()}`,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      status: l.status,
      proofDocumentUrl: l.proofDocumentUrl,
      docUrl: l.proofDocumentUrl,
      supportingDoc: l.proofDocumentUrl,
      approvalComments: l.approvalComments,
      tgRemarks: l.tgRemarks || l.approvalComments,
      tgRecommendation: l.tgRemarks || l.approvalComments,
      hodRemarks: l.hodRemarks,
      reviewedByTeacherId: l.reviewedByTeacherId,
      recommendedAt: l.recommendedAt,
      approvedByHodId: l.approvedByHodId,
      approvedAt: l.approvedAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    });

    const formattedConsiderations = considerations.map(formatConsideration);
    const formattedCorrections = corrections.map(formatCorrection);
    const formattedLeaves = leaves.map(formatLeave);

    const formattedRequests = [
      ...formattedConsiderations,
      ...formattedCorrections,
      ...formattedLeaves
    ];

    formattedRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      total: formattedRequests.length,
      requests: formattedRequests,
      attendanceRequests: formattedConsiderations,
      considerationRequests: formattedConsiderations,
      attendanceQueries: formattedCorrections,
      correctionRequests: formattedCorrections,
      leaveRequests: formattedLeaves
    });
  } catch (error) {
    logger.error(`[Request Controller] GetAll error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Submit Attendance Consideration
exports.submitAttendanceConsideration = async (req, res) => {
  try {
    const isStudentCaller = req.user?.role === 'STUDENT' || req.user?.roleName === 'STUDENT';
    let studentId = isStudentCaller ? req.user?.studentId : (req.body.studentId || req.user?.studentId);

    if (!studentId && req.user?.id) {
      const st = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (st) studentId = st.id;
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Valid student profile is required to lodge requests.'
      });
    }

    await ensureStudentHasTg(studentId);

    const { startDate, endDate, category = 'Academic On-Duty (OD)', reason, subjectId } = req.body;
    const proofDocumentUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.proofDocumentUrl || null);

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'startDate, endDate, and reason are required.' });
    }

    let periodsData = null;
    if (req.body.periods) {
      try {
        periodsData = typeof req.body.periods === 'string' ? JSON.parse(req.body.periods) : req.body.periods;
      } catch (e) {
        periodsData = req.body.periods;
      }
    } else if (req.body.selectedPeriods || req.body.periodsTiming || req.body.periodsCount) {
      periodsData = {
        selectedPeriods: req.body.selectedPeriods || [],
        periodsCount: req.body.periodsCount || (Array.isArray(req.body.selectedPeriods) ? req.body.selectedPeriods.length : 0),
        periodsTiming: req.body.periodsTiming || ''
      };
    }

    const request = await prisma.attendanceConsiderationRequest.create({
      data: {
        studentId,
        subjectId: subjectId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        category: category.substring(0, 50),
        reason,
        proofDocumentUrl,
        periods: periodsData,
        status: 'PENDING'
      },
      include: {
        student: {
          include: {
            section: true,
            department: true,
            tutorGuardian: { include: { user: true } }
          }
        },
        subject: true
      }
    });

    // Image 3 Workflow: Check if TG is available
    const assignedTg = request.student?.tutorGuardian;
    let isTgAvailable = false;
    if (assignedTg && assignedTg.status === 'ACTIVE' && assignedTg.availability_status !== 'On Leave') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const tgLeave = await prisma.leaveApplication.findFirst({
        where: {
          applicantType: 'TEACHER',
          teacherId: assignedTg.id,
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart }
        }
      });
      if (!tgLeave) {
        isTgAvailable = true;
      }
    }

    const studentName = `${request.student?.firstName || 'Student'} ${request.student?.lastName || ''}`.trim();
    if (isTgAvailable && assignedTg?.userId) {
      await sendNotification({
        userId: assignedTg.userId,
        recipientRole: 'TG',
        title: `New request from ${studentName}`,
        message: `${studentName} lodged an On-Duty consideration request (${category}).`,
        type: 'INFO',
        linkUrl: '/tg/requests'
      });
    } else {
      // TG unavailable -> direct to HOD
      await prisma.attendanceConsiderationRequest.update({
        where: { id: request.id },
        data: {
          tgRemarks: assignedTg ? 'TG currently on leave. Routed directly to HOD.' : 'No designated TG assigned. Routed directly to HOD.'
        }
      });

      await sendNotification({
        recipientRole: 'HOD',
        title: `Direct OD Request: ${studentName}`,
        message: `${studentName} lodged an On-Duty consideration request (${category}). Mentor unavailable / on leave — forwarded directly to HOD.`,
        type: 'WARNING',
        linkUrl: '/hod/requests'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Attendance consideration request submitted successfully. Forwarded to Mentor / TG for review.',
      request
    });
  } catch (error) {
    logger.error(`[Request Controller] Submit consideration error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2b. TG Review Attendance Consideration
exports.tgReviewAttendanceConsideration = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, recommendation, status = 'RECOMMENDED_BY_TG' } = req.body;

    const existing = await prisma.attendanceConsiderationRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true, tutorGuardian: true } } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED' || s === 'APPROVED_BY_HOD') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    // Role check: if caller is a TG, verify mentee ownership
    const isTg = req.user?.role === 'TG' && !req.user?.isHOD && req.user?.role !== 'ADMIN';
    if (isTg && existing.student?.tgTeacherId && req.user?.teacherId !== existing.student.tgTeacherId) {
      return res.status(403).json({
        success: false,
        message: 'You are not the designated Tutor Guardian for this student.'
      });
    }

    const updated = await prisma.attendanceConsiderationRequest.update({
      where: { id },
      data: {
        status,
        reviewedByTgId: req.user?.teacherId || null,
        tgRemarks: comments || recommendation || 'Recommended by Tutor Guardian',
        recommendedAt: new Date()
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    // Notify HOD
    await sendNotification({
      recipientRole: 'HOD',
      title: `TG Recommendation: ${updated.student?.firstName || 'Student'}`,
      message: `OD consideration request has been recommended by Mentor and forwarded for sign-off.`,
      type: 'INFO',
      linkUrl: '/hod/requests'
    });

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your OD request was recommended',
        message: 'Your Tutor Guardian has recommended your OD consideration to the HOD.',
        type: 'SUCCESS',
        linkUrl: '/student/requests'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Consideration request reviewed by TG and forwarded to HOD.',
      request: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2c. TG Reject Attendance Consideration
exports.tgRejectAttendanceConsideration = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, reason } = req.body;

    const existing = await prisma.attendanceConsiderationRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED' || s === 'APPROVED_BY_HOD') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const updated = await prisma.attendanceConsiderationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedByTgId: req.user?.teacherId || null,
        tgRemarks: comments || reason || 'Rejected by TG',
        rejectedBy: req.user?.name || 'Tutor Guardian',
        rejectedAt: new Date(),
        rejectionReason: comments || reason || 'Rejected by Tutor Guardian'
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your consideration request was rejected',
        message: `Your OD consideration was rejected by TG: ${comments || reason || 'Criteria not met.'}`,
        type: 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Consideration request rejected by TG.',
      request: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2d. HOD Approve Attendance Consideration (Updates attendance records to EXCUSED)
exports.hodApproveAttendanceConsideration = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const existing = await prisma.attendanceConsiderationRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED' || s === 'APPROVED_BY_HOD') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const updated = await prisma.attendanceConsiderationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByHodId: req.user?.teacherId || req.user?.id || null,
        hodRemarks: comments || 'Approved by HOD',
        approvedAt: new Date()
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    // Test 7: Correct matching ABSENT attendance records in date range to EXCUSED
    try {
      const recordsToUpdate = await prisma.attendanceRecord.findMany({
        where: {
          studentId: existing.studentId,
          status: { in: ['ABSENT', 'Absent'] },
          attendance: {
            date: {
              gte: existing.startDate,
              lte: existing.endDate
            },
            ...(existing.subjectId ? { subjectId: existing.subjectId } : {})
          }
        },
        include: { attendance: true }
      });

      if (recordsToUpdate.length > 0) {
        const recordIds = recordsToUpdate.map(r => r.id);
        await prisma.attendanceRecord.updateMany({
          where: { id: { in: recordIds } },
          data: {
            status: 'EXCUSED',
            remarks: 'On-Duty / Excused via HOD Approved Consideration'
          }
        });

        // Recalculate parent attendance session counts
        const attendanceIds = [...new Set(recordsToUpdate.map(r => r.attendanceId))];
        for (const attId of attendanceIds) {
          const totalRecords = await prisma.attendanceRecord.count({ where: { attendanceId: attId } });
          const presentRecords = await prisma.attendanceRecord.count({
            where: { attendanceId: attId, status: { in: ['PRESENT', 'Present', 'LATE', 'Late', 'EXCUSED', 'Excused'] } }
          });
          await prisma.attendance.update({
            where: { id: attId },
            data: {
              totalStudents: totalRecords,
              presentCount: presentRecords,
              absentCount: Math.max(0, totalRecords - presentRecords)
            }
          });
        }
      }
    } catch (attErr) {
      logger.warn(`[hodApproveAttendanceConsideration] Attendance record update: ${attErr.message}`);
    }

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your OD consideration was approved',
        message: 'Your OD consideration request has been officially approved by HOD.',
        type: 'SUCCESS',
        linkUrl: '/student/requests'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'APPROVED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({
      success: true,
      message: 'Consideration request officially approved by HOD.',
      request: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2e. HOD Reject Attendance Consideration
exports.hodRejectAttendanceConsideration = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, reason } = req.body;

    const existing = await prisma.attendanceConsiderationRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED' || s === 'APPROVED_BY_HOD') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const updated = await prisma.attendanceConsiderationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user?.name || 'HOD',
        rejectedAt: new Date(),
        rejectionReason: comments || reason || 'Rejected by HOD',
        hodRemarks: comments || reason || 'Rejected by HOD'
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your consideration request was rejected',
        message: `Your OD consideration was rejected by HOD: ${comments || reason || 'Disapproved.'}`,
        type: 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'REJECTED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({
      success: true,
      message: 'Consideration request rejected.',
      request: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Submit Attendance Query (Dispute)
exports.submitAttendanceQuery = async (req, res) => {
  try {
    const isStudentCaller = req.user?.role === 'STUDENT' || req.user?.roleName === 'STUDENT';
    let studentId = isStudentCaller ? req.user?.studentId : (req.body.studentId || req.user?.studentId);

    if (!studentId && req.user?.id) {
      const st = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (st) studentId = st.id;
    }

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Valid student profile required.' });
    }

    await ensureStudentHasTg(studentId);

    const { date, reason, requestedStatus = 'PRESENT', subject } = req.body;
    let subjectId = req.body.subjectId;

    if (!subjectId) {
      if (subject) {
        const sub = await prisma.subject.findFirst({
          where: {
            OR: [
              { name: { contains: subject, mode: 'insensitive' } },
              { code: { contains: subject, mode: 'insensitive' } }
            ]
          }
        });
        if (sub) subjectId = sub.id;
      }
      if (!subjectId) {
        const fallbackSub = await prisma.subject.findFirst();
        subjectId = fallbackSub?.id;
      }
    }

    const supportingDocUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.supportingDocUrl || null);

    if (!date || !reason || !subjectId) {
      return res.status(400).json({ success: false, message: 'Date, subject, and reason are required to lodge dispute.' });
    }

    // Try to find matching AttendanceRecord
    const queryDate = new Date(date);
    let matchedRecordId = req.body.attendanceRecordId || null;
    if (!matchedRecordId) {
      const existingRecord = await prisma.attendanceRecord.findFirst({
        where: {
          studentId,
          attendance: {
            subjectId,
            date: queryDate
          }
        }
      });
      if (existingRecord) matchedRecordId = existingRecord.id;
    }

    const query = await prisma.attendanceCorrectionRequest.create({
      data: {
        studentId,
        subjectId,
        attendanceRecordId: matchedRecordId,
        date: queryDate,
        requestedStatus,
        reason,
        supportingDocUrl,
        status: 'PENDING'
      },
      include: {
        student: {
          include: {
            section: true,
            department: true,
            tutorGuardian: { include: { user: true } }
          }
        },
        subject: true
      }
    });

    // Notify TG
    const studentName = `${query.student?.firstName || 'Student'} ${query.student?.lastName || ''}`.trim();
    const tgUserId = query.student?.tutorGuardian?.userId;
    if (tgUserId) {
      await sendNotification({
        userId: tgUserId,
        recipientRole: 'TG',
        title: `New request from ${studentName}`,
        message: `${studentName} lodged an attendance dispute query for ${query.subject?.name || 'lecture'}.`,
        type: 'INFO',
        linkUrl: '/tg/requests'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Attendance dispute query submitted. Forwarded to mentor & HOD for review.',
      query
    });
  } catch (error) {
    logger.error(`[Request Controller] Submit query error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3b. TG Review Attendance Query
exports.tgReviewAttendanceQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote, comments } = req.body;

    const existing = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true, tutorGuardian: true } }, subject: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Query not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const isTg = req.user?.role === 'TG' && !req.user?.isHOD && req.user?.role !== 'ADMIN';
    if (isTg && existing.student?.tgTeacherId && req.user?.teacherId !== existing.student.tgTeacherId) {
      return res.status(403).json({
        success: false,
        message: 'You are not the designated Tutor Guardian for this student.'
      });
    }

    const note = reviewNote || comments || 'Verified by Mentor/TG; forwarded to HOD.';

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'RECOMMENDED_BY_TG',
        reviewedByTeacherId: req.user?.teacherId || null,
        reviewNote: note,
        tgRemarks: note,
        recommendedAt: new Date()
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    // Notify HOD
    await sendNotification({
      recipientRole: 'HOD',
      title: `TG Recommendation: Attendance Query`,
      message: `Dispute from ${updated.student?.firstName || 'Student'} verified and recommended by TG.`,
      type: 'INFO',
      linkUrl: '/hod/requests'
    });

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your attendance query was verified',
        message: 'Your Tutor Guardian has verified your attendance dispute and forwarded it to the HOD.',
        type: 'SUCCESS',
        linkUrl: '/student/requests'
      });
    }

    return res.status(200).json({ success: true, message: 'Attendance query reviewed by TG.', query: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3c. TG Reject Attendance Query
exports.tgRejectAttendanceQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote, comments, reason } = req.body;

    const existing = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Query not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const note = reviewNote || comments || reason || 'Dispute rejected by Tutor Guardian';

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedByTeacherId: req.user?.teacherId || null,
        reviewNote: note,
        tgRemarks: note,
        rejectedBy: req.user?.name || 'Tutor Guardian',
        rejectedAt: new Date(),
        rejectionReason: note
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your attendance query was rejected',
        message: `Your attendance dispute was rejected by TG: ${note}`,
        type: 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    return res.status(200).json({ success: true, message: 'Attendance query rejected by TG.', query: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3d. HOD Approve Attendance Query (Corrects absent attendance record to PRESENT)
exports.hodApproveAttendanceQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const existing = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Query not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByHodId: req.user?.teacherId || req.user?.id || null,
        hodRemarks: comments || 'Approved by HOD',
        approvedAt: new Date()
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    // Test 7: Correct matching AttendanceRecord to PRESENT
    try {
      let targetRecord = null;
      if (existing.attendanceRecordId) {
        targetRecord = await prisma.attendanceRecord.findUnique({
          where: { id: existing.attendanceRecordId },
          include: { attendance: true }
        });
      }

      if (!targetRecord) {
        targetRecord = await prisma.attendanceRecord.findFirst({
          where: {
            studentId: existing.studentId,
            attendance: {
              subjectId: existing.subjectId,
              date: existing.date
            }
          },
          include: { attendance: true }
        });
      }

      if (targetRecord) {
        await prisma.attendanceRecord.update({
          where: { id: targetRecord.id },
          data: {
            status: existing.requestedStatus || 'PRESENT',
            verificationMethod: 'AI_CORRECTION',
            remarks: 'Absent record corrected to Present via HOD approved attendance query',
            markedAt: new Date()
          }
        });

        // Update parent session totals
        const attId = targetRecord.attendanceId;
        const totalRecords = await prisma.attendanceRecord.count({ where: { attendanceId: attId } });
        const presentRecords = await prisma.attendanceRecord.count({
          where: { attendanceId: attId, status: { in: ['PRESENT', 'Present', 'LATE', 'Late', 'EXCUSED', 'Excused'] } }
        });

        await prisma.attendance.update({
          where: { id: attId },
          data: {
            totalStudents: totalRecords,
            presentCount: presentRecords,
            absentCount: Math.max(0, totalRecords - presentRecords)
          }
        });
      }
    } catch (attErr) {
      logger.warn(`[hodApproveAttendanceQuery] Failed to update attendance record: ${attErr.message}`);
    }

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your attendance query was approved',
        message: 'Your attendance dispute query was approved and your record was corrected to Present.',
        type: 'SUCCESS',
        linkUrl: '/student/attendance'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'APPROVED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({ success: true, message: 'Attendance query approved.', query: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3e. HOD Reject Attendance Query (Test 10 fix: endpoint exists and functions)
exports.hodRejectAttendanceQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, reason } = req.body;

    const existing = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Query not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user?.name || 'HOD',
        rejectedAt: new Date(),
        rejectionReason: comments || reason || 'Rejected by HOD',
        hodRemarks: comments || reason || 'Rejected by HOD'
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your attendance query was rejected',
        message: `Your attendance dispute query has been rejected by HOD: ${comments || reason || 'Disapproved.'}`,
        type: 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'REJECTED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({ success: true, message: 'Attendance query rejected.', query: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Leave Application (Test 1 fix: binds to authentic logged-in student)
exports.applyLeave = async (req, res) => {
  try {
    const { applicantType = 'STUDENT', leaveType = 'CASUAL', startDate, endDate, reason } = req.body;
    const proofDocumentUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.proofDocumentUrl || null);

    const isStudentCaller = req.user?.role === 'STUDENT' || req.user?.roleName === 'STUDENT';
    let studentId = (applicantType === 'STUDENT' && isStudentCaller)
      ? req.user?.studentId
      : (req.body.studentId || req.user?.studentId);
    let teacherId = req.body.teacherId || req.user?.teacherId;

    if (applicantType === 'STUDENT' && !studentId && req.user?.id) {
      const st = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (st) studentId = st.id;
    }

    if (applicantType === 'STUDENT' && !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Valid student profile required to submit a student leave application.'
      });
    }

    if (applicantType === 'STUDENT') {
      await ensureStudentHasTg(studentId);
    }

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'startDate, endDate, and reason are required.' });
    }

    const calculatedDays = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
    const totalDays = parseFloat(req.body.totalDays) || calculatedDays;

    const leave = await prisma.leaveApplication.create({
      data: {
        applicantType,
        studentId: applicantType === 'STUDENT' ? studentId : null,
        teacherId: applicantType === 'TEACHER' ? teacherId : null,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        reason,
        proofDocumentUrl,
        status: 'PENDING'
      },
      include: {
        student: {
          include: {
            section: true,
            department: true,
            tutorGuardian: { include: { user: true } }
          }
        },
        teacher: true
      }
    });

    // Image 3 Workflow: Check if TG is available for student leave
    const studentName = `${leave.student?.firstName || 'Student'} ${leave.student?.lastName || ''}`.trim();
    if (applicantType === 'STUDENT') {
      const assignedTg = leave.student?.tutorGuardian;
      let isTgAvailable = false;
      if (assignedTg && assignedTg.status === 'ACTIVE' && assignedTg.availability_status !== 'On Leave') {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const tgLeave = await prisma.leaveApplication.findFirst({
          where: {
            applicantType: 'TEACHER',
            teacherId: assignedTg.id,
            status: { in: ['APPROVED', 'PENDING'] },
            startDate: { lte: todayEnd },
            endDate: { gte: todayStart }
          }
        });
        if (!tgLeave) {
          isTgAvailable = true;
        }
      }

      if (isTgAvailable && assignedTg?.userId) {
        await sendNotification({
          userId: assignedTg.userId,
          recipientRole: 'TG',
          title: `New request from ${studentName}`,
          message: `${studentName} applied for ${leaveType} leave (${totalDays} day(s)).`,
          type: 'INFO',
          linkUrl: '/tg/requests'
        });
      } else {
        // TG unavailable -> direct to HOD
        await prisma.leaveApplication.update({
          where: { id: leave.id },
          data: {
            tgRemarks: assignedTg ? 'TG currently on leave. Routed directly to HOD.' : 'No designated TG assigned. Routed directly to HOD.'
          }
        });

        await sendNotification({
          recipientRole: 'HOD',
          title: `Direct Student Leave: ${studentName}`,
          message: `${studentName} applied for ${leaveType} leave (${totalDays} day(s)). Mentor unavailable / on leave — forwarded directly to HOD.`,
          type: 'WARNING',
          linkUrl: '/hod/requests'
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully. Forwarded to mentor & HOD.',
      leave
    });
  } catch (error) {
    logger.error(`[Request Controller] Apply leave error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4b. TG Review Leave (Test 6 & 10 fix: records reviewedByTeacherId, tgRemarks, timestamps)
exports.tgReviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, approved = true, status } = req.body;

    const existing = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { student: { include: { user: true, tutorGuardian: true } }, teacher: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Leave application not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This request has already been finalized.' });
    }

    const isTg = req.user?.role === 'TG' && !req.user?.isHOD && req.user?.role !== 'ADMIN';
    if (isTg && existing.student?.tgTeacherId && req.user?.teacherId !== existing.student.tgTeacherId) {
      return res.status(403).json({
        success: false,
        message: 'You are not the designated Tutor Guardian for this student.'
      });
    }

    const finalStatus = status || (approved ? 'RECOMMENDED_BY_TG' : 'REJECTED');
    const remark = comments || (approved ? 'Recommended by TG' : 'Rejected by TG');

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: finalStatus,
        reviewedByTeacherId: req.user?.teacherId || null,
        tgRemarks: remark,
        recommendedAt: new Date(),
        approvalComments: remark
      },
      include: { student: { include: { user: true } }, teacher: true }
    });

    // Notify HOD if recommended
    if (finalStatus === 'RECOMMENDED_BY_TG') {
      await sendNotification({
        recipientRole: 'HOD',
        title: `TG Recommendation: Leave Application`,
        message: `Leave for ${updated.student?.firstName || 'Student'} recommended by Tutor Guardian.`,
        type: 'INFO',
        linkUrl: '/hod/requests'
      });
    }

    // Notify Student
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: approved ? 'Your leave was recommended' : 'Your leave was rejected',
        message: approved
          ? 'Your Tutor Guardian has recommended your leave application to the HOD.'
          : `Your leave was rejected by TG: ${remark}`,
        type: approved ? 'SUCCESS' : 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    return res.status(200).json({ success: true, message: 'Leave application reviewed by TG.', leave: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4c. TG Reject Leave
exports.tgRejectLeave = async (req, res) => {
  return exports.tgReviewLeave({ ...req, body: { ...req.body, approved: false, status: 'REJECTED' } }, res);
};

// 4d. HOD Approve Leave (Test 6 & 8 fix: checks finalized, records approvedByHodId, hodRemarks, separate timestamps)
exports.hodApproveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const existing = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, teacher: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Leave application not found.' });
    }

    // Test 8 fix: Finished requests cannot be approved again
    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: `This leave application has already been ${s.toLowerCase()} and cannot be modified.`
      });
    }

    const hodRemark = comments || 'Approved by HOD';
    const combinedComments = existing.approvalComments
      ? `${existing.approvalComments} | HOD: ${hodRemark}`
      : hodRemark;

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByHodId: req.user?.teacherId || req.user?.id || null,
        hodRemarks: hodRemark,
        approvedAt: new Date(),
        approvalComments: combinedComments
      },
      include: { student: { include: { user: true } }, teacher: true }
    });

    // Notify Student (Test 9 fix)
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your leave was approved',
        message: 'Your leave application has been officially approved by HOD.',
        type: 'SUCCESS',
        linkUrl: '/student/requests'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'APPROVED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({ success: true, message: 'Leave application approved by HOD.', leave: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4e. HOD Reject Leave (Test 8 fix: checks finalized, records rejection metadata)
exports.hodRejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, reason } = req.body;

    const existing = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, teacher: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Leave application not found.' });
    }

    const s = String(existing.status).toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: `This leave application has already been ${s.toLowerCase()} and cannot be modified.`
      });
    }

    const rejectReason = comments || reason || 'Rejected by HOD';
    const combinedComments = existing.approvalComments
      ? `${existing.approvalComments} | HOD Rejected: ${rejectReason}`
      : rejectReason;

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user?.name || 'HOD',
        rejectedAt: new Date(),
        rejectionReason: rejectReason,
        hodRemarks: rejectReason,
        approvalComments: combinedComments
      },
      include: { student: { include: { user: true } }, teacher: true }
    });

    // Notify Student (Test 9 fix)
    if (updated.student?.userId) {
      await sendNotification({
        userId: updated.student.userId,
        recipientRole: 'STUDENT',
        title: 'Your leave was rejected',
        message: `Your leave application was rejected by HOD: ${rejectReason}`,
        type: 'WARNING',
        linkUrl: '/student/requests'
      });
    }

    // Live Stream to Linked Google Sheet
    googleSheetSyncService.syncRecord(updated, 'REJECTED').catch((err) => {
      logger.warn(`[GoogleSheetSync] Live sync error: ${err.message}`);
    });

    return res.status(200).json({ success: true, message: 'Leave application rejected.', leave: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// Google Live Sheet Endpoints (HOD Approval Dashboard Live Integration)
// ============================================================================

// 5a. Get Google Sheet Configuration (FE-01: Redact webhook URL for non-privileged viewers)
exports.getGoogleSheetConfig = async (req, res) => {
  try {
    const config = googleSheetSyncService.getConfig();
    const role = (req.user?.role || '').toUpperCase();
    const isPrivileged = role === 'HOD' || role === 'ADMIN';

    const safeConfig = {
      sheetUrl: config.sheetUrl,
      autoSyncEnabled: config.autoSyncEnabled,
      lastSyncedAt: config.lastSyncedAt,
      totalSynced: config.totalSynced,
      department: config.department,
      webhookUrl: isPrivileged ? config.webhookUrl : undefined
    };

    return res.status(200).json({ success: true, config: safeConfig });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5b. Save Google Sheet Configuration
exports.saveGoogleSheetConfig = async (req, res) => {
  try {
    const { sheetUrl, webhookUrl, autoSyncEnabled, department } = req.body;
    const config = googleSheetSyncService.saveConfig({ sheetUrl, webhookUrl, autoSyncEnabled, department });
    return res.status(200).json({
      success: true,
      message: 'Google Sheet configuration saved successfully.',
      config
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5c. Sync All Records (Historical / Approved) to Google Sheet
exports.syncAllToGoogleSheet = async (req, res) => {
  try {
    const { webhookUrl, filter = 'approved' } = req.body || {};

    const [leaves, considerations, queries] = await Promise.all([
      prisma.leaveApplication.findMany({
        where: filter === 'approved' ? { status: { in: ['APPROVED', 'approved', 'approved_by_hod'] } } : {},
        include: { student: { include: { user: true, section: true } }, teacher: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.attendanceConsiderationRequest.findMany({
        where: filter === 'approved' ? { status: { in: ['APPROVED', 'approved', 'approved_by_hod'] } } : {},
        include: { student: { include: { user: true, section: true } }, subject: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.attendanceCorrectionRequest.findMany({
        where: filter === 'approved' ? { status: { in: ['APPROVED', 'approved', 'approved_by_hod'] } } : {},
        include: { student: { include: { user: true, section: true } }, subject: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const allRecords = [
      ...leaves.map(l => ({ ...l, type: 'leave_request' })),
      ...considerations.map(c => ({ ...c, type: 'attendance_consideration' })),
      ...queries.map(q => ({ ...q, type: 'attendance_query' }))
    ];

    if (allRecords.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No matching records found to sync.',
        count: 0
      });
    }

    const result = await googleSheetSyncService.syncBatch(allRecords, webhookUrl);
    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${result.count} records to Google Sheet.`,
      count: result.count
    });
  } catch (error) {
    logger.error(`[syncAllToGoogleSheet] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5d. Test Google Sheet Webhook Connection
exports.testGoogleSheetConnection = async (req, res) => {
  try {
    const { webhookUrl } = req.body || {};
    const result = await googleSheetSyncService.testConnection(webhookUrl);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
