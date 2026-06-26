// server/routes/accountSetup.routes.js

const express = require('express');
const router = express.Router();

const accountSetupCtrl = require('../controllers/accountSetup.controller');

router.post('/create-order', accountSetupCtrl.createActivationOrder);
router.post('/verify-payment', accountSetupCtrl.verifyActivationPayment);

module.exports = router;