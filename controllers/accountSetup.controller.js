// server/controllers/accountSetup.controller.js

const crypto = require('crypto');
const Razorpay = require('razorpay');

const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// CREATE ORDER
exports.createActivationOrder = async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return next(new AppError('Razorpay keys are missing in .env', 500));
    }

    const order = await razorpay.orders.create({
      amount: 2499 * 100,
      currency: 'INR',
      receipt: `activation_${Date.now()}`,
      notes: {
        purpose: 'Account Activation',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        order,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    next(err);
  }
};

// VERIFY PAYMENT
exports.verifyActivationPayment = async (req, res, next) => {
  try {
    const {
      email,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!email) {
      return next(new AppError('Email is required to activate account', 400));
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return next(new AppError('Payment verification failed', 400));
    }

    const user = await User.findOne({
      email,
      role: 'admin',
      isActive: false,
    });

    if (!user) {
      return next(new AppError('Inactive admin account not found', 404));
    }

    user.isActive = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully',
    });
  } catch (err) {
    next(err);
  }
};