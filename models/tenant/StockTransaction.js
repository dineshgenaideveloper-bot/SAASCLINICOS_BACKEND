const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      trim: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      required: true,
    },

    itemName: { type: String, required: true },
    itemCode: { type: String, trim: true },

    batchNumber: { type: String, trim: true },

    transactionType: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment', 'transfer', 'expiry', 'damage'],
      required: true,
    },

    quantity: { type: Number, required: true },

    previousStock: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },

    unitPrice: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    referenceId: { type: String, trim: true },
    referenceType: { type: String, trim: true },

    notes: { type: String, trim: true },
    performedBy: { type: String, trim: true },

    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stockTransactionSchema.pre('save', async function (next) {
  try {
    if (!this.transactionId) {
      const lastTransaction = await this.constructor.findOne(
        { transactionId: { $regex: /^TRX-\d+$/ } },
        {},
        { sort: { createdAt: -1 } }
      );

      let lastId = 0;

      if (lastTransaction?.transactionId) {
        const match = lastTransaction.transactionId.match(/TRX-(\d+)/);
        if (match) lastId = Number(match[1]) || 0;
      }

      this.transactionId = `TRX-${String(lastId + 1).padStart(8, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const StockTransactionModel = (connection) => {
  return (
    connection.models.StockTransaction ||
    connection.model('StockTransaction', stockTransactionSchema)
  );
};

module.exports = StockTransactionModel;