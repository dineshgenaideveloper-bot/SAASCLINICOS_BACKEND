// server/routes/dashboardRoutes.js

const express = require('express');

const {
  getDashboard,
  getSaasDashboard,
} = require('../controllers/dashboardController');

const {
  tenantMiddleware,
} = require('../middleware/tenantMiddleware');

const router = express.Router();

router.get('/', tenantMiddleware, getDashboard);

router.get('/saas', getSaasDashboard);

module.exports = router;