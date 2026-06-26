// server/routes/tenant/staffPayslipRoutes.js
const express = require('express');

const {
  getAllStaffPayslips,
  getStaffPayslip,
  getMyPayslip,
} = require('../../controllers/tenant/staffPayslipController.js');

const router = express.Router();

router.get('/me', getMyPayslip);
router.get('/', getAllStaffPayslips);
router.get('/staff/:staffId', getStaffPayslip);

module.exports = router;