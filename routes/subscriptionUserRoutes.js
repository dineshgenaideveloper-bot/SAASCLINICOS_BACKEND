const express = require('express');

const {
  getMySubscription,
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require('../controllers/subscriptionUserController');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/my-subscription', protect, getMySubscription);

router.post('/create-order', protect, createRazorpayOrder);

router.post('/verify-payment', protect, verifyRazorpayPayment);

module.exports = router;