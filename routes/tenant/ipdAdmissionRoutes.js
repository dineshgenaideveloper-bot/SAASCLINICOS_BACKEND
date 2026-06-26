const express = require('express');

const {
  getAdmissions,
  getAdmissionById,
  allocateBed,

  addVitals,
  addNursingNote,
  addDoctorRound,

  addLabOrder,
  issueMedicine,
  addIpdCharge,
  saveDischargeSummary,
  saveFinalSettlement,
  releaseBed,
  getIpdReports,

  dischargeAdmission,
} = require('../../controllers/tenant/ipdAdmissionController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.get('/', tenantMiddleware, getAdmissions);

/*
  Important:
  Keep this before "/:id", otherwise Express treats "reports"
  as an admission id.
*/
router.get('/reports/summary', tenantMiddleware, getIpdReports);

router.post('/allocate', tenantMiddleware, allocateBed);

router.get('/:id', tenantMiddleware, getAdmissionById);

router.post('/:id/vitals', tenantMiddleware, addVitals);
router.post('/:id/nursing-notes', tenantMiddleware, addNursingNote);
router.post('/:id/doctor-rounds', tenantMiddleware, addDoctorRound);

router.post('/:id/lab-orders', tenantMiddleware, addLabOrder);
router.post('/:id/medicine-issues', tenantMiddleware, issueMedicine);
router.post('/:id/charges', tenantMiddleware, addIpdCharge);

router.patch('/:id/discharge-summary', tenantMiddleware, saveDischargeSummary);
router.patch('/:id/final-settlement', tenantMiddleware, saveFinalSettlement);
router.patch('/:id/bed-release', tenantMiddleware, releaseBed);

/*
  Legacy compatibility endpoint.
  This does NOT release the bed.
*/
router.patch('/:id/discharge', tenantMiddleware, dischargeAdmission);

module.exports = router;