// server/routes/referral.routes.js

const express = require('express');
const router = express.Router();

const referralCtrl = require('../controllers/referral.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/inactive-clinics', protect, referralCtrl.getInactiveClinics);
router.post('/create-order', protect, referralCtrl.createActivationOrder);
router.post('/verify-payment', protect, referralCtrl.verifyActivationPayment);

module.exports = router;