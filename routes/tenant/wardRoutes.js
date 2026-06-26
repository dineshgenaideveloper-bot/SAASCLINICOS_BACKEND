const express = require('express');

const {
  getWards,
  getWardById,
  createWard,
  updateWard,
  deleteWard,
  updateWardStatus,
} = require('../../controllers/tenant/wardController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.get('/', tenantMiddleware, getWards);
router.get('/:id', tenantMiddleware, getWardById);
router.post('/', tenantMiddleware, createWard);
router.patch('/:id/status', tenantMiddleware, updateWardStatus);
router.patch('/:id', tenantMiddleware, updateWard);
router.delete('/:id', tenantMiddleware, deleteWard);

module.exports = router;