const express = require('express');

const {
  getLoginPrices,
  createLoginPrice,
  updateLoginPrice,
  deleteLoginPrice,
  updateLoginPriceStatus,
} = require('../controllers/loginPriceController');

const router = express.Router();

router.get('/', getLoginPrices);

router.post('/', createLoginPrice);

router.patch('/:id', updateLoginPrice);

router.delete('/:id', deleteLoginPrice);

router.patch(
  '/:id/status',
  updateLoginPriceStatus
);

module.exports = router;