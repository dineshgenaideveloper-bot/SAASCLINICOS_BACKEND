// server/routes/tenant/patient.routes.js
const express = require('express');

const PatientModel = require('../../models/tenant/Patient');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const { tenantMiddleware } = require('../../middleware/tenantMiddleware');
const patientController = require('../../controllers/tenant/patient.controller');

const router = express.Router();

// ── GET /patients  → paginated, searched, sorted ──────────────────────────────
// Replaces the old find-all that was timing out on large datasets.
// Query params: page, limit, search, sortBy, sortOrder
router.get('/', tenantMiddleware, patientController.getPatients);

// ── GET /patients/:id ─────────────────────────────────────────────────────────
router.get('/:id', tenantMiddleware, patientController.getPatientById);

// ── PATCH /patients/:id ───────────────────────────────────────────────────────
router.patch('/:id', tenantMiddleware, patientController.updatePatient);

// ── PUT /patients/:patientId/visits/:visitId ──────────────────────────────────
router.put(
  '/:patientId/visits/:visitId',
  tenantMiddleware,
  patientController.updatePatientVisit
);

// ── PATCH /patients/:patientId/visits/:visitId/complete ───────────────────────
router.patch(
  '/:patientId/visits/:visitId/complete',
  tenantMiddleware,
  patientController.completePatientVisit
);

// ── POST /patients/:patientId/visits/:visitId/prescriptions ───────────────────
router.post(
  '/:patientId/visits/:visitId/prescriptions',
  tenantMiddleware,
  async (req, res) => {
    try {
      const Patient = PatientModel(req.tenantDb);
      const ItemMaster = ItemMasterModel(req.tenantDb);

      const { patientId, visitId } = req.params;
      const { prescriptions = [] } = req.body;

      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const visit = patient.visits.id(visitId);
      if (!visit) {
        return res.status(404).json({ success: false, message: 'Visit not found' });
      }

      const finalPrescriptions = [];

      for (const p of prescriptions) {
        if (!p.item) continue;

        const item = await ItemMaster.findById(p.item);
        if (!item) continue;

        const durationDays = Number(p.durationDays || 1);

        finalPrescriptions.push({
          item: item._id,
          itemId: item.itemId,
          itemName: item.name,
          genericName: item.genericName || '',
          categoryName: item.categoryName || '',

          dosage: p.dosage || '',
          frequency: p.frequency || '',
          timing: p.timing || '',
          duration: p.duration || '',

          morning:   { beforeFood: !!p.morning?.beforeFood,   afterFood: !!p.morning?.afterFood },
          afternoon: { beforeFood: !!p.afternoon?.beforeFood, afterFood: !!p.afternoon?.afterFood },
          evening:   { beforeFood: !!p.evening?.beforeFood,   afterFood: !!p.evening?.afterFood },
          night:     { beforeFood: !!p.night?.beforeFood,     afterFood: !!p.night?.afterFood },

          durationDays,
          durationEnglish: `${durationDays} days`,
          durationTamil:   `${durationDays} நாட்கள்`,

          quantity: Number(p.quantity || 1),
          instructions: p.instructions || '',
          price: item.sellingPrice || 0,
        });
      }

      visit.prescriptions = finalPrescriptions;
      patient.markModified('visits');
      await patient.save();

      res.json({
        success: true,
        message: 'Prescription saved successfully',
        data: patient,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;