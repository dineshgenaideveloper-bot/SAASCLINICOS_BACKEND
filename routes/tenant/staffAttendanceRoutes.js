import express from 'express';

import {
  getAttendanceConfig,
  saveAttendanceConfig,
  getAttendance,
  getTodayAttendance,
  checkIn,
  checkOut,
  getAttendanceSummary,
  getMyAttendanceStatus,
  checkInMe,
  checkOutMe,
  getMyAttendance,
} from '../../controllers/tenant/staffAttendanceController.js';

import {
  createMyAttendanceRegularization,
  createStaffAttendanceRegularization,
  getAttendanceRegularizations,
  getMyAttendanceRegularizations,
  approveAttendanceRegularization,
  rejectAttendanceRegularization,
} from '../../controllers/tenant/staffAttendanceRegularizationController.js';

const router = express.Router();

// Attendance config
router.get('/config', getAttendanceConfig);
router.put('/config', saveAttendanceConfig);

// Attendance
router.get('/', getAttendance);
router.get('/today', getTodayAttendance);
router.get('/summary', getAttendanceSummary);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);

// My attendance
router.get('/me/status', getMyAttendanceStatus);
router.get('/me', getMyAttendance);
router.post('/me/check-in', checkInMe);
router.post('/me/check-out', checkOutMe);

// My regularizations
router.get('/me/regularizations', getMyAttendanceRegularizations);
router.post('/me/regularizations', createMyAttendanceRegularization);

// Staff/admin regularizations
router.get('/regularizations', getAttendanceRegularizations);
router.post('/regularizations', createStaffAttendanceRegularization);
router.patch('/regularizations/:id/approve', approveAttendanceRegularization);
router.patch('/regularizations/:id/reject', rejectAttendanceRegularization);

export default router;