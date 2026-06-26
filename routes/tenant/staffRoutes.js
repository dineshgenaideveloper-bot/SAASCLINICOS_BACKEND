const express = require('express');
const multer = require('multer');

const {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  importStaff,
} = require('../../controllers/tenant/staffController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', tenantMiddleware, getStaff);
router.post('/', tenantMiddleware, createStaff);
router.patch('/:id', tenantMiddleware, updateStaff);
router.delete('/:id', tenantMiddleware, deleteStaff);
router.post('/import', tenantMiddleware, upload.single('file'), importStaff);

module.exports = router;