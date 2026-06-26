// routes/tenant/clientDashboardRoutes.js

const express = require('express');
const router = express.Router();

const {
  getClientDashboard,
} = require('../../controllers/tenant/clientDashboardController');

const { protect } = require('../../middleware/auth.middleware');
const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

router.get('/', protect, tenantMiddleware, getClientDashboard);

module.exports = router;