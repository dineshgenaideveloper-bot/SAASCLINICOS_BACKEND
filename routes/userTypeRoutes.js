const express = require('express');

const {
  getUserTypes,
  createUserType,
  updateUserType,
  deleteUserType,
  updateUserTypeStatus,
} = require('../controllers/userTypeController');

const router = express.Router();

router.get('/', getUserTypes);
router.post('/', createUserType);
router.patch('/:id', updateUserType);
router.delete('/:id', deleteUserType);

router.patch('/:id/status', updateUserTypeStatus);

module.exports = router;