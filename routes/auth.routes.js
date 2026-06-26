// server/routes/auth.routes.js
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('clinicName').trim().notEmpty().withMessage('Clinic name required'),
];

router.post('/register', registerValidation, authCtrl.register);
router.post('/login', loginValidation, authCtrl.login);
router.post('/refresh', authCtrl.refreshToken);
router.post('/logout', protect, authCtrl.logout);
router.get('/me', protect, authCtrl.getMe);
router.patch('/change-password', protect, authCtrl.changePassword);

module.exports = router;
