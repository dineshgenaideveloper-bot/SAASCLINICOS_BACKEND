// server/routes/tenant/staffPayslipRoutes.js
import express from 'express';

import {
  getAllStaffPayslips,
  getStaffPayslip,
  getMyPayslip,
} from '../../controllers/tenant/staffPayslipController.js';

const router = express.Router();

router.get('/me', getMyPayslip);
router.get('/', getAllStaffPayslips);
router.get('/staff/:staffId', getStaffPayslip);

export default router;