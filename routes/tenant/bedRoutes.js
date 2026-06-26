const express = require('express');

const {
  getBeds,
  getBedById,
  createBed,
  updateBed,
  deleteBed,
  updateBedStatus,
} = require('../../controllers/tenant/bedController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.get('/', tenantMiddleware, getBeds);
router.get('/:id', tenantMiddleware, getBedById);
router.post('/', tenantMiddleware, createBed);
router.patch('/:id/status', tenantMiddleware, updateBedStatus);
router.patch('/:id', tenantMiddleware, updateBed);
router.delete('/:id', tenantMiddleware, deleteBed);

module.exports = router;