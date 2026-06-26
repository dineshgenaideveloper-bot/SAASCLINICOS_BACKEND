const express = require('express');

const {
  getMyDoctorTokens,
  callToken,
  completeToken,
  cancelToken,
} = require('../../controllers/tenant/doctorCallBoardController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.use(tenantMiddleware);

router.get('/my-tokens', getMyDoctorTokens);
router.patch('/:id/call', callToken);
router.patch('/:id/complete', completeToken);
router.patch('/:id/cancel', cancelToken);

module.exports = router;