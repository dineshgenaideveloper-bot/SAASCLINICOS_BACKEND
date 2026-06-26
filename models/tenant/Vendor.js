const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    alternatePhone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    suppliedItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemMaster',
      },
    ],

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
    },

    drugLicenseNumber: {
      type: String,
      trim: true,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    pincode: {
      type: String,
      trim: true,
    },

    paymentTerms: {
      type: String,
      trim: true,
      default: 'Immediate',
    },

    bankName: {
      type: String,
      trim: true,
    },

    accountHolderName: {
      type: String,
      trim: true,
    },

    accountNumber: {
      type: String,
      trim: true,
    },

    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

vendorSchema.pre('validate', async function (next) {
  if (!this.vendorId) {
    const count = await this.constructor.countDocuments();
    this.vendorId = `VND-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

const VendorModel = (connection) => {
  return connection.models.Vendor || connection.model('Vendor', vendorSchema);
};

module.exports = VendorModel;