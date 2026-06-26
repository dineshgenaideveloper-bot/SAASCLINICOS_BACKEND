// controllers/subscriptionSetupController.js - Complete with Razorpay Integration

const Clinic = require('../models/Clinic');
const Feature = require('../models/Feature');
const UserType = require('../models/UserType');
const LoginPrice = require('../models/LoginPrice');
const Billing = require('../models/Billing');
const SubscriptionPermission = require('../models/SubscriptionPermission');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper function to check if bill already exists for a period
const checkExistingBillForPeriod = async (tenantId, startDate, endDate) => {
  const existingBill = await Billing.findOne({
    tenantId,
    status: { $in: ['Pending', 'Paid'] },
    $or: [
      {
        startDate: { $lt: endDate },
        endDate: { $gt: startDate }
      },
      {
        startDate: startDate,
        endDate: endDate
      }
    ]
  });
  return existingBill;
};

// Get all subscription setup data
exports.getSubscriptionSetupData = async (req, res) => {
  try {
    const [clinics, features, userTypes, loginPrices, permissions] =
      await Promise.all([
        Clinic.find().populate('owner', 'name email role').sort({ createdAt: -1 }),
        Feature.find({ isActive: true }).sort({ name: 1 }),
        UserType.find({ isActive: true }).sort({ userTypeName: 1 }),
        LoginPrice.find({ isActive: true }).sort({ planName: 1 }),
        SubscriptionPermission.find()
          .populate('features', 'name price')
          .populate('userTypes', 'userTypeName price')
          .populate('loginPricePlan', 'planName price')
          .populate('currentBillId'),
      ]);

    const bills = await Billing.find({
      tenantId: { $in: permissions.map(p => p.tenantId) }
    }).sort({ createdAt: -1 });

    const billsByTenant = bills.reduce((acc, bill) => {
      if (!acc[bill.tenantId]) acc[bill.tenantId] = [];
      acc[bill.tenantId].push(bill);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        clinics,
        features,
        userTypes,
        loginPrices,
        permissions,
        billsByTenant,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription setup data',
      error: error.message,
    });
  }
};

// Create or update subscription
exports.createOrUpdateSubscription = async (req, res) => {
  try {
    const {
      clinicId,
      tenantId,
      features = [],
      userTypes = [],
      loginPricePlan,
      loginCount = 1,
      basePrice = 0,
      finalPrice = 0,
      useBasePrice = true,
    } = req.body;

    if (!clinicId || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'clinicId and tenantId are required',
      });
    }

    const existingSubscription = await SubscriptionPermission.findOne({ tenantId });
    
    let permission;
    let bill = null;
    const now = new Date();

    if (!existingSubscription) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      const existingBill = await checkExistingBillForPeriod(tenantId, startDate, endDate);
      
      if (!existingBill) {
        const invoiceNo = `INV-${tenantId}-${Date.now()}-1`;
        
        bill = await Billing.create({
          tenantId,
          clinic: clinicId,
          invoiceNo,
          startDate,
          endDate,
          dueDate: endDate,
          amount: finalPrice,
          status: 'Pending',
          description: 'Initial subscription setup',
          billPeriod: 1,
          generatedBy: 'manual',
          paymentMethod: null,
        });
      }

      permission = await SubscriptionPermission.create({
        tenantId,
        clinic: clinicId,
        features,
        userTypes,
        loginPricePlan,
        loginCount,
        basePrice,
        finalPrice,
        useBasePrice,
        isActive: false,
        currentBillId: bill?._id,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        lastBillGenerated: now,
        nextBillGenerationDate: new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000),
      });

      if (bill) {
        bill.subscriptionId = permission._id;
        await bill.save();
      }

    } else {
      permission = await SubscriptionPermission.findOneAndUpdate(
        { tenantId },
        {
          clinic: clinicId,
          features,
          userTypes,
          loginPricePlan,
          loginCount,
          basePrice,
          finalPrice,
          useBasePrice,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      const activePaidBill = await Billing.findOne({
        tenantId,
        status: 'Paid',
        endDate: { $gte: now }
      });
      
      const pendingBillForCurrentPeriod = await Billing.findOne({
        tenantId,
        status: 'Pending',
        endDate: { $gte: now }
      });

      if (!activePaidBill && !pendingBillForCurrentPeriod) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        const existingBill = await checkExistingBillForPeriod(tenantId, startDate, endDate);
        
        if (!existingBill) {
          const invoiceNo = `INV-${tenantId}-${Date.now()}-${(await Billing.countDocuments({ tenantId })) + 1}`;
          
          bill = await Billing.create({
            tenantId,
            clinic: clinicId,
            invoiceNo,
            startDate,
            endDate,
            dueDate: endDate,
            amount: finalPrice,
            status: 'Pending',
            description: 'Subscription renewal',
            billPeriod: (await Billing.countDocuments({ tenantId })) + 1,
            generatedBy: 'manual',
            paymentMethod: null,
          });
          
          permission.currentBillId = bill._id;
          permission.subscriptionStartDate = startDate;
          permission.subscriptionEndDate = endDate;
          permission.isActive = false;
          permission.nextBillGenerationDate = new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
          await permission.save();
        }
      }
    }

    res.status(201).json({
      success: true,
      message: existingSubscription ? 'Subscription updated successfully' : 'Subscription created',
      data: {
        permission,
        billing: bill,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save subscription',
      error: error.message,
    });
  }
};

// Get permission by tenant ID
exports.getPermissionByTenantId = async (req, res) => {
  try {
    const permission = await SubscriptionPermission.findOne({
      tenantId: req.params.tenantId,
    })
      .populate('clinic', 'name tenantId')
      .populate('features', 'name price path')
      .populate('userTypes', 'userTypeName price icon')
      .populate('loginPricePlan', 'planName price')
      .populate('currentBillId');

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission',
      error: error.message,
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const permission = await SubscriptionPermission.findOneAndUpdate(
      { tenantId },
      { isActive: false },
      { new: true }
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    await Billing.updateMany(
      { tenantId, status: 'Pending' },
      { status: 'Cancelled' }
    );

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: permission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message,
    });
  }
};

// Get billing history
exports.getBillingHistory = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const bills = await Billing.find({ tenantId })
      .sort({ createdAt: -1 })
      .populate('clinic', 'name');

    res.json({
      success: true,
      data: bills,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing history',
      error: error.message,
    });
  }
};

// Generate manual bill
exports.generateManualBill = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { customAmount, description } = req.body;

    let permission = await SubscriptionPermission.findOne({ tenantId })
      .populate('clinic');

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this tenant',
      });
    }

    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const existingBill = await Billing.findOne({
      tenantId,
      status: { $in: ['Pending', 'Paid', 'Overdue'] },
      $or: [
        {
          startDate: startDate,
          endDate: endDate
        },
        {
          startDate: { $lt: endDate },
          endDate: { $gt: startDate }
        }
      ]
    });
    
    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: `A bill already exists for this period (${existingBill.invoiceNo}). Please use the existing bill.`,
        data: existingBill
      });
    }
    
    const activePeriod = await Billing.findOne({
      tenantId,
      status: 'Paid',
      endDate: { $gte: now }
    });
    
    if (activePeriod) {
      return res.status(400).json({
        success: false,
        message: `Subscription is already active until ${activePeriod.endDate.toLocaleDateString()}. Cannot generate a new bill for the same period.`,
        data: activePeriod
      });
    }
    
    const pendingBill = await Billing.findOne({
      tenantId,
      status: 'Pending',
      endDate: { $gt: now }
    });
    
    if (pendingBill) {
      return res.status(400).json({
        success: false,
        message: `A pending bill (${pendingBill.invoiceNo}) already exists until ${pendingBill.endDate.toLocaleDateString()}. Please process that bill first.`,
        data: pendingBill
      });
    }

    const billCount = await Billing.countDocuments({ tenantId });
    const invoiceNo = `INV-${tenantId}-${Date.now()}-${billCount + 1}`;

    const bill = await Billing.create({
      tenantId,
      clinic: permission.clinic._id,
      invoiceNo,
      startDate,
      endDate,
      dueDate: endDate,
      amount: customAmount || permission.finalPrice,
      status: 'Pending',
      description: description || 'Manual bill generation',
      billPeriod: billCount + 1,
      generatedBy: 'manual',
      paymentMethod: null,
    });

    // Update subscription with new bill and deactivate until payment
    permission.currentBillId = bill._id;
    permission.subscriptionStartDate = startDate;
    permission.subscriptionEndDate = endDate;
    permission.isActive = false;
    permission.nextBillGenerationDate = new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    await permission.save();

    res.status(201).json({
      success: true,
      message: 'Manual bill generated successfully. Subscription will be activated after payment.',
      data: bill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate manual bill',
      error: error.message,
    });
  }
};

// OPTION 1: ADMIN MARK AS PAID (Manual/Cash/Cheque)
exports.adminMarkAsPaid = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMethod, transactionId, notes } = req.body;
    // paymentMethod can be: 'cash', 'cheque', 'bank_transfer', 'offline'

    console.log('Admin marking bill as paid:', billId);

    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }
    
    if (bill.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already marked as paid',
      });
    }
    
    if (bill.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark a cancelled bill as paid',
      });
    }

    // Update bill to paid (Admin override)
    bill.status = 'Paid';
    bill.paidAt = new Date();
    bill.paymentMethod = paymentMethod || 'offline';
    bill.transactionId = transactionId || `ADMIN-${Date.now()}`;
    bill.paymentNotes = notes || 'Marked as paid by admin';
    await bill.save();
    
    console.log('Bill updated to Paid by Admin');

    // Find and activate subscription
    let permission = await SubscriptionPermission.findOne({ tenantId: bill.tenantId });
    
    if (!permission) {
      const clinic = await Clinic.findById(bill.clinic);
      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: 'Clinic not found',
        });
      }
      
      permission = await SubscriptionPermission.create({
        tenantId: bill.tenantId,
        clinic: bill.clinic,
        features: [],
        userTypes: [],
        finalPrice: bill.amount,
        isActive: true,
        currentBillId: bill._id,
        subscriptionStartDate: bill.startDate,
        subscriptionEndDate: bill.endDate,
        lastBillGenerated: new Date(),
        nextBillGenerationDate: new Date(bill.endDate.getTime() - 3 * 24 * 60 * 60 * 1000),
      });
    } else {
      permission.isActive = true;
      permission.currentBillId = bill._id;
      permission.subscriptionStartDate = bill.startDate;
      permission.subscriptionEndDate = bill.endDate;
      permission.lastBillGenerated = new Date();
      permission.nextBillGenerationDate = new Date(bill.endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
      await permission.save();
    }

    // Cancel other pending bills
    await Billing.updateMany(
      {
        tenantId: bill.tenantId,
        status: 'Pending',
        _id: { $ne: billId }
      },
      { 
        status: 'Cancelled',
        description: `Cancelled automatically as bill ${bill.invoiceNo} was paid by admin`
      }
    );

    res.json({
      success: true,
      message: `Bill marked as paid via ${paymentMethod || 'offline'}. Subscription activated.`,
      data: {
        bill,
        subscription: {
          isActive: permission.isActive,
          startDate: permission.subscriptionStartDate,
          endDate: permission.subscriptionEndDate
        }
      },
    });
  } catch (error) {
    console.error('Admin mark as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark bill as paid',
      error: error.message,
    });
  }
};

// OPTION 2: CREATE RAZORPAY ORDER (User pays online)
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }
    
    if (bill.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already paid',
      });
    }
    
    if (bill.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create order for cancelled bill',
      });
    }

    // Check if order already exists and is not expired
    if (bill.razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'An order already exists for this bill',
        data: {
          orderId: bill.razorpayOrderId,
          amount: bill.amount
        }
      });
    }

    const options = {
      amount: bill.amount * 100, // Amount in paise
      currency: 'INR',
      receipt: bill.invoiceNo,
      payment_capture: 1,
      notes: {
        billId: bill._id.toString(),
        tenantId: bill.tenantId,
        invoiceNo: bill.invoiceNo
      }
    };

    const order = await razorpayInstance.orders.create(options);
    
    // Save order ID to bill
    bill.razorpayOrderId = order.id;
    await bill.save();

    res.json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        orderId: order.id,
        amount: bill.amount,
        currency: order.currency,
        billId: bill._id,
        invoiceNo: bill.invoiceNo,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message,
    });
  }
};

// OPTION 2: VERIFY RAZORPAY PAYMENT (After user pays)
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentId,
      signature,
      billId
    } = req.body;

    console.log('Verifying Razorpay payment:', { orderId, paymentId, billId });

    // Verify signature
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }
    
    if (bill.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already paid',
      });
    }

    // Update bill to paid
    bill.status = 'Paid';
    bill.paidAt = new Date();
    bill.paymentMethod = 'razorpay';
    bill.razorpayPaymentId = paymentId;
    bill.razorpaySignature = signature;
    await bill.save();

    // Find and activate subscription
    let permission = await SubscriptionPermission.findOne({ tenantId: bill.tenantId });
    
    if (!permission) {
      const clinic = await Clinic.findById(bill.clinic);
      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: 'Clinic not found',
        });
      }
      
      permission = await SubscriptionPermission.create({
        tenantId: bill.tenantId,
        clinic: bill.clinic,
        features: [],
        userTypes: [],
        finalPrice: bill.amount,
        isActive: true,
        currentBillId: bill._id,
        subscriptionStartDate: bill.startDate,
        subscriptionEndDate: bill.endDate,
        lastBillGenerated: new Date(),
        nextBillGenerationDate: new Date(bill.endDate.getTime() - 3 * 24 * 60 * 60 * 1000),
      });
    } else {
      permission.isActive = true;
      permission.currentBillId = bill._id;
      permission.subscriptionStartDate = bill.startDate;
      permission.subscriptionEndDate = bill.endDate;
      permission.lastBillGenerated = new Date();
      permission.nextBillGenerationDate = new Date(bill.endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
      await permission.save();
    }

    // Cancel other pending bills
    await Billing.updateMany(
      {
        tenantId: bill.tenantId,
        status: 'Pending',
        _id: { $ne: billId }
      },
      { 
        status: 'Cancelled',
        description: `Cancelled automatically as bill ${bill.invoiceNo} was paid via Razorpay`
      }
    );

    res.json({
      success: true,
      message: 'Payment verified and subscription activated successfully',
      data: {
        bill,
        subscription: {
          isActive: permission.isActive,
          startDate: permission.subscriptionStartDate,
          endDate: permission.subscriptionEndDate
        }
      }
    });
  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message,
    });
  }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        status: bill.status,
        paymentMethod: bill.paymentMethod,
        paidAt: bill.paidAt,
        amount: bill.amount,
        invoiceNo: bill.invoiceNo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message,
    });
  }
};

// Cancel bill
exports.cancelBill = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }
    
    if (bill.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid bill',
      });
    }
    
    bill.status = 'Cancelled';
    bill.description = bill.description + ' (Cancelled by admin)';
    await bill.save();
    
    const permission = await SubscriptionPermission.findOne({ 
      tenantId: bill.tenantId,
      currentBillId: billId 
    });
    
    if (permission) {
      permission.isActive = false;
      await permission.save();
    }
    
    res.json({
      success: true,
      message: 'Bill cancelled successfully',
      data: bill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel bill',
      error: error.message,
    });
  }
};