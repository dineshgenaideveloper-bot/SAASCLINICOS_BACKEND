const express = require('express');

const {
  createPurchaseOrder,
  receivePurchaseOrder,
  getPurchaseOrders,
  cancelPurchaseOrder,
} = require('../../controllers/tenant/purchaseOrderController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.use(tenantMiddleware);

router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.patch('/:id/receive', receivePurchaseOrder);
router.patch('/:id/cancel', cancelPurchaseOrder); // Add this line

module.exports = router;