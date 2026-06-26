// models/SubscriptionPermission.js
const mongoose = require('mongoose');

const subscriptionPermissionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },

    features: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feature',
      },
    ],

    userTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserType',
      },
    ],

    loginPricePlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoginPrice',
    },

    loginCount: {
      type: Number,
      default: 1,
    },

    basePrice: {
      type: Number,
      default: 0,
    },

    finalPrice: {
      type: Number,
      default: 0,
    },

    useBasePrice: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Track subscription period
    currentBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Billing',
    },

    subscriptionStartDate: {
      type: Date,
    },

    subscriptionEndDate: {
      type: Date,
    },

    lastBillGenerated: {
      type: Date,
    },

    nextBillGenerationDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPermission', subscriptionPermissionSchema);