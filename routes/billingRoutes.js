const express = require('express');

const {
  getBillings,
  updateBillingStatus,
} = require('../controllers/billingController');

const router = express.Router();

router.get('/', getBillings);

router.patch(
  '/:id/status',
  updateBillingStatus
);

module.exports = router;