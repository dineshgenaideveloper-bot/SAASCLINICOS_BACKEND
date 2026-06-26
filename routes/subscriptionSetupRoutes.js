// routes/subscriptionSetupRoutes.js
const express = require('express');
const {
  getSubscriptionSetupData,
  createOrUpdateSubscription,
  getPermissionByTenantId,
  cancelSubscription,
  getBillingHistory,
  generateManualBill,
  adminMarkAsPaid,        // OPTION 1: Admin marks as paid
  createRazorpayOrder,    // OPTION 2: Create Razorpay order
  verifyRazorpayPayment,  // OPTION 2: Verify payment
  getPaymentStatus,       // Check payment status
  cancelBill,
} = require('../controllers/subscriptionSetupController');

const router = express.Router();

// General routes
router.get('/data', getSubscriptionSetupData);
router.get('/permission/:tenantId', getPermissionByTenantId);
router.post('/', createOrUpdateSubscription);
router.post('/:tenantId/cancel', cancelSubscription);
router.get('/:tenantId/billing-history', getBillingHistory);
router.post('/:tenantId/generate-bill', generateManualBill);
router.post('/cancel-bill/:billId', cancelBill);

// OPTION 1: Admin marks as paid (Cash/Cheque/Offline)
router.post('/admin-mark-paid/:billId', adminMarkAsPaid);

// OPTION 2: Razorpay online payment
router.post('/create-order/:billId', createRazorpayOrder);
router.post('/verify-payment', verifyRazorpayPayment);
router.get('/payment-status/:billId', getPaymentStatus);

module.exports = router;