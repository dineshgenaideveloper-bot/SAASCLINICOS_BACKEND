const express = require('express');

const {
  getPatientTokens,
  createPatientToken,
  updatePatientTokenStatus,
  deletePatientToken,
} = require('../../controllers/tenant/patientTokenController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.use(tenantMiddleware);

router.get('/', getPatientTokens);
router.post('/', createPatientToken);
router.patch('/:id/status', updatePatientTokenStatus);
router.delete('/:id', deletePatientToken);

module.exports = router;