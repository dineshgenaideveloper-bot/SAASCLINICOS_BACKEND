const express = require('express');

const {
  createMedicalBill,
  getMedicalBills,
} = require('../../controllers/tenant/medicalBillController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.use(tenantMiddleware);

router.get('/', getMedicalBills);
router.post('/', createMedicalBill);

module.exports = router;