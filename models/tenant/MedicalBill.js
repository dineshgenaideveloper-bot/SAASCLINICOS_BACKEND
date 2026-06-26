const mongoose = require('mongoose');

const medicalBillItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      required: true,
    },
    itemName: { type: String, trim: true },
    itemCode: { type: String, trim: true },

    quantity: { type: Number, required: true },
    unitPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    gstRate: { type: Number, default: 0 },

cgstRate: { type: Number, default: 0 },
sgstRate: { type: Number, default: 0 },
igstRate: { type: Number, default: 0 },

cgstAmount: { type: Number, default: 0 },
sgstAmount: { type: Number, default: 0 },
igstAmount: { type: Number, default: 0 },

taxableAmount: { type: Number, default: 0 },
gstAmount: { type: Number, default: 0 },

    total: { type: Number, default: 0 },


  },
  { _id: false }
);

const medicalBillSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      unique: true,
      trim: true,
    },

    patientName: { type: String, trim: true },
    patientPhone: { type: String, trim: true },

    items: [medicalBillItemSchema],

    subTotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'card', 'credit'],
      default: 'cash',
    },

    status: {
      type: String,
      enum: ['paid', 'pending', 'cancelled'],
      default: 'paid',
    },

    cgstAmount: { type: Number, default: 0 },
sgstAmount: { type: Number, default: 0 },
igstAmount: { type: Number, default: 0 },
gstAmount: { type: Number, default: 0 },
isInterState: { type: Boolean, default: false },
placeOfSupply: { type: String, trim: true },

    notes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

medicalBillSchema.pre('save', async function (next) {
  try {
    if (!this.billNumber) {
      const lastBill = await this.constructor.findOne(
        { billNumber: { $regex: /^MB-\d+$/ } },
        {},
        { sort: { createdAt: -1 } }
      );

      let lastId = 0;

      if (lastBill?.billNumber) {
        const match = lastBill.billNumber.match(/MB-(\d+)/);
        if (match) lastId = Number(match[1]) || 0;
      }

      this.billNumber = `MB-${String(lastId + 1).padStart(6, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const MedicalBillModel = (connection) => {
  return (
    connection.models.MedicalBill ||
    connection.model('MedicalBill', medicalBillSchema)
  );
};

module.exports = MedicalBillModel;