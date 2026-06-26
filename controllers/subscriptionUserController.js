const crypto = require('crypto');
const Razorpay = require('razorpay');

const SubscriptionPermission = require('../models/SubscriptionPermission');
const Billing = require('../models/Billing');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.getMySubscription = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const permission = await SubscriptionPermission.findOne({ tenantId })
      .populate('clinic', 'name tenantId')
      .populate('features', 'name module path price')
      .populate('userTypes', 'userTypeName icon price')
      .populate('loginPricePlan', 'planName price');

    const billings = await Billing.find({ tenantId })
      .populate('clinic', 'name tenantId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        permission,
        billings,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription details',
      error: error.message,
    });
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { billingId } = req.body;
    const tenantId = req.user.tenantId;

    const billing = await Billing.findOne({
      _id: billingId,
      tenantId,
      status: 'Pending',
    });

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Pending bill not found',
      });
    }

    const amountInPaise = Math.round(Number(billing.amount || 0) * 100);

    if (amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing amount',
      });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: process.env.RAZORPAY_CURRENCY || 'INR',
      receipt: billing.invoiceNo,
      notes: {
        tenantId: billing.tenantId,
        billingId: billing._id.toString(),
        invoiceNo: billing.invoiceNo,
      },
    });

    billing.razorpayOrderId = order.id;
    await billing.save();

    res.json({
      success: true,
      data: {
        order,
        billing,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message,
    });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      billingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const tenantId = req.user.tenantId;

    const billing = await Billing.findOne({
      _id: billingId,
      tenantId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found',
      });
    }

    if (!billing.razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order not found for this bill',
      });
    }

    if (billing.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Razorpay order ID',
      });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${billing.razorpayOrderId}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    billing.status = 'Paid';
    billing.razorpayPaymentId = razorpay_payment_id;
    billing.razorpaySignature = razorpay_signature;
    billing.paidAt = new Date();

    await billing.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: billing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message,
    });
  }
};