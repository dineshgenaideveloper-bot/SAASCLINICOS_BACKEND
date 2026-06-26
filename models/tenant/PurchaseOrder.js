const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      required: true,
    },
    itemName: { type: String, trim: true },
    itemCode: { type: String, trim: true },

    batchNumber: { type: String, trim: true },
    expiryDate: Date,

    quantity: { type: Number, required: true },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },

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

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      unique: true,
      trim: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    vendorName: { type: String, trim: true },

    items: [purchaseOrderItemSchema],

    subTotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },

    isInterState: { type: Boolean, default: false },
    placeOfSupply: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },

    status: {
      type: String,
      enum: ['draft', 'received', 'cancelled'],
      default: 'draft',
    },

    deliveryInvoiceNo: {
      type: String,
      trim: true,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: String,
      trim: true,
    },

    notes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre('save', async function (next) {
  try {
    if (!this.poNumber) {
      const lastOrder = await this.constructor.findOne(
        { poNumber: { $regex: /^PO-\d+$/ } },
        {},
        { sort: { createdAt: -1 } }
      );

      let lastId = 0;

      if (lastOrder?.poNumber) {
        const match = lastOrder.poNumber.match(/PO-(\d+)/);
        if (match) lastId = Number(match[1]) || 0;
      }

      this.poNumber = `PO-${String(lastId + 1).padStart(6, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const PurchaseOrderModel = (connection) => {
  return (
    connection.models.PurchaseOrder ||
    connection.model('PurchaseOrder', purchaseOrderSchema)
  );
};

module.exports = PurchaseOrderModel;