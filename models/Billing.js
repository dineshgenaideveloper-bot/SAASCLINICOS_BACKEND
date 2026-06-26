// models/Billing.js - Add paymentMethod field
const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },

    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Cancelled', 'Overdue'],
      default: 'Pending',
    },

    description: {
      type: String,
      default: 'Subscription fee',
    },

    // Payment fields
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'cash', 'cheque', 'bank_transfer', 'offline', null],
      default: null,
    },

    transactionId: {
      type: String, // For offline/cash/cheque transactions
    },

    paymentNotes: {
      type: String, // Admin notes for offline payments
    },

    // Razorpay fields
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    paidAt: Date,

    billPeriod: {
      type: Number,
      default: 1,
    },

    generatedBy: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Billing', billingSchema);