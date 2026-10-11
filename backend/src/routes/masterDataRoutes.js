// ============================================================================
// Departmental ERP - Master Data Routes
// Real endpoints for Teachers, Students, Subjects, Classrooms & Timetables
// Supports Add, Edit, Delete, Bulk CSV/Excel Preview, Confirm & Export
// ============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const masterDataController = require('../controllers/masterDataController');
const { verifyToken, checkRole, optionalAuth } = require('../middleware/auth');
const { prisma } = require('../config/postgres');

// 1. Generic Preview & Confirm Workflow for UI (Admin & HOD only)
router.post('/import/preview', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), (req, res, next) => {
  const type = req.query.type || 'teachers';
  req.query.dryRun = 'true';
  if (type === 'teachers') return masterDataController.importTeachers(req, res, next);
  if (type === 'students') return masterDataController.importStudents(req, res, next);
  if (type === 'subjects') return masterDataController.importSubjects(req, res, next);
  if (type === 'classrooms') return masterDataController.importClassrooms(req, res, next);
  if (type === 'timetables' || type === 'timetable') return masterDataController.importTimetable(req, res, next);
  return res.status(400).json({ success: false, message: `Invalid import type: ${type}` });
});

router.post('/import/confirm', verifyToken, checkRole('ADMIN', 'HOD'), (req, res, next) => {
  const type = req.query.type || 'teachers';
  req.query.dryRun = 'false';
  if (type === 'teachers') return masterDataController.importTeachers(req, res, next);
  if (type === 'students') return masterDataController.importStudents(req, res, next);
  if (type === 'subjects') return masterDataController.importSubjects(req, res, next);
  if (type === 'classrooms') return masterDataController.importClassrooms(req, res, next);
  if (type === 'timetables' || type === 'timetable') return masterDataController.importTimetable(req, res, next);
  return res.status(400).json({ success: false, message: `Invalid import type: ${type}` });
});

// 2. Generic Export Endpoint
router.get('/export/:type', verifyToken, (req, res, next) => {
  const { type } = req.params;
  if (type === 'teachers') return masterDataController.exportTeachers(req, res, next);
  if (type === 'students') return masterDataController.exportStudents(req, res, next);
  if (type === 'subjects') return masterDataController.exportSubjects(req, res, next);
  if (type === 'classrooms') return masterDataController.exportClassrooms(req, res, next);
  if (type === 'timetables' || type === 'timetable') return masterDataController.exportTimetable(req, res, next);
  return res.status(400).json({ success: false, message: `Invalid export type: ${type}` });
});

// 2.1 Sample Data Format & Template Download (.xlsx & .csv)
router.get('/sample-template/:type', optionalAuth, (req, res, next) => {
  return masterDataController.getSampleTemplate(req, res, next);
});

// 3. Timetables Master Data List & Delete
router.get('/timetables', optionalAuth, async (req, res) => {
  try {
    const list = await prisma.timetable.findMany({
      include: {
        department: true,
        section: true,
        slots: {
          include: {
            subject: true,
            teacher: true,
            classroom: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: list, timetables: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/timetables/:id', verifyToken, checkRole('ADMIN', 'HOD'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timetableSlot.deleteMany({ where: { timetableId: id } });
    await prisma.timetable.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Timetable and all slots deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Single Entity Creation
router.post('/teachers', verifyToken, checkRole('ADMIN', 'HOD'), async (req, res, next) => {
  req.body = { records: [req.body] };
  return masterDataController.importTeachers(req, res, next);
});

router.post('/students', verifyToken, checkRole('ADMIN', 'HOD'), async (req, res, next) => {
  req.body = { records: [req.body] };
  return masterDataController.importStudents(req, res, next);
});

router.post('/subjects', verifyToken, checkRole('ADMIN', 'HOD'), async (req, res, next) => {
  req.body = { records: [req.body] };
  return masterDataController.importSubjects(req, res, next);
});

// 5. Direct legacy paths & Delete aliases
const academicController = require('../controllers/academicController');
const facultyController = require('../controllers/facultyController');
const studentController = require('../controllers/studentController');
const classroomController = require('../controllers/classroomController');

router.delete('/subjects/:id', verifyToken, checkRole('ADMIN', 'HOD'), academicController.deleteSubject);
router.delete('/teachers/:id', verifyToken, checkRole('ADMIN', 'HOD'), facultyController.deleteFaculty);
router.delete('/students/:id', verifyToken, checkRole('ADMIN', 'HOD'), studentController.deleteStudent);
router.delete('/classrooms/:id', verifyToken, checkRole('ADMIN', 'HOD'), classroomController.deleteClassroom);

router.post('/teachers/import', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), masterDataController.importTeachers);
router.get('/teachers/export', verifyToken, masterDataController.exportTeachers);
router.post('/students/import', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), masterDataController.importStudents);
router.get('/students/export', verifyToken, masterDataController.exportStudents);
router.post('/subjects/import', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), masterDataController.importSubjects);
router.get('/subjects/export', verifyToken, masterDataController.exportSubjects);
router.post('/classrooms/import', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), masterDataController.importClassrooms);
router.get('/classrooms/export', verifyToken, masterDataController.exportClassrooms);
router.post('/timetable/import', verifyToken, checkRole('ADMIN', 'HOD'), upload.single('file'), masterDataController.importTimetable);

module.exports = router;
