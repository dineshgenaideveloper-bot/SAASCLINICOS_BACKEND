const express = require('express');
const multer = require('multer');

const {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  updateVendorStatus,
  importVendors,
  downloadVendorTemplate,
} = require('../../controllers/tenant/vendorController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', tenantMiddleware, getVendors);
router.get('/template', tenantMiddleware, downloadVendorTemplate);
router.get('/:id', tenantMiddleware, getVendorById);

router.post('/', tenantMiddleware, createVendor);
router.post('/import', tenantMiddleware, upload.single('file'), importVendors);

router.patch('/:id', tenantMiddleware, updateVendor);
router.patch('/:id/status', tenantMiddleware, updateVendorStatus);

router.delete('/:id', tenantMiddleware, deleteVendor);

module.exports = router;