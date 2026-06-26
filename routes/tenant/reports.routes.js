// server/routes/tenant/reports.routes.js
const express = require('express');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');
const reports = require('../../controllers/tenant/reports.controller');

const router = express.Router();

// GET /reports                       -> list every available report (build your UI menu from this)
router.get('/', tenantMiddleware, reports.listReports);

// GET /reports/:key                  -> JSON preview
// GET /reports/:key?format=pdf       -> download (format = pdf | excel | csv | word)
// Filters (any one block):
//   ?period=today|yesterday|week|month|year|all
//   ?month=3&year=2026
//   ?year=2025
//   ?from=2026-01-01&to=2026-01-31
// Some reports take extra params, e.g. patient-visit-history needs ?patientId=PAT-00001
router.get('/:key', tenantMiddleware, reports.runReport);

module.exports = router;