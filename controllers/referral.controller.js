// server/controllers/referral.controller.js

const crypto = require('crypto');
const Razorpay = require('razorpay');

const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.getInactiveClinics = async (req, res, next) => {
  try {
    const users = await User.find({
      role: 'admin',
      isActive: false,
    })
      .populate('clinic', 'name tenantId address')
      .sort({ createdAt: -1 });

    const data = users.map((user) => ({
      userId: user._id,
      ownerName: user.name,
      ownerEmail: user.email,
      tenantId: user.tenantId,
      clinicId: user.clinic?._id,
      clinicName: user.clinic?.name || 'Clinic',
      city: user.clinic?.address?.city || '',
      isActive: user.isActive,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.createActivationOrder = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await User.findOne({
      _id: userId,
      role: 'admin',
      isActive: false,
    });

    if (!user) {
      return next(new AppError('Inactive admin user not found', 404));
    }

    const order = await razorpay.orders.create({
      amount: 499 * 100,
      currency: 'INR',
      receipt: `referral_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        tenantId: user.tenantId,
        purpose: 'Referral Activation',
      },
    });

    res.status(200).json({
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

exports.verifyActivationPayment = async (req, res, next) => {
  try {
    const {
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return next(new AppError('Payment verification failed', 400));
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        role: 'admin',
        isActive: false,
      },
      {
        isActive: true,
      },
      {
        new: true,
      }
    );

    if (!user) {
      return next(new AppError('Inactive admin user not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Clinic admin activated successfully',
    });
  } catch (err) {
    next(err);
  }
};