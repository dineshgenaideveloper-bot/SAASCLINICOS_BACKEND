const express = require('express');

const {
  getStaffLoginAccess,
  createStaffLoginAccess,
  updateStaffLoginAccess,
  deleteStaffLoginAccess,
} = require('../controllers/staffLoginAccess.controller');

const { protect } = require('../middleware/auth.middleware');
const { tenantMiddleware } = require('../middleware/tenantMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', tenantMiddleware, getStaffLoginAccess);

router.post('/', tenantMiddleware, createStaffLoginAccess);

router.patch('/:staffId', tenantMiddleware, updateStaffLoginAccess);

router.delete('/:staffId', tenantMiddleware, deleteStaffLoginAccess);

module.exports = router;