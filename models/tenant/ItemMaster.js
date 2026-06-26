const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true, trim: true },
  manufacturer: { type: String, trim: true },
  mfgDate: Date,
  expiryDate: Date,
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  rackNumber: { type: String, trim: true },
  receivedDate: { type: Date, default: Date.now }
});

const itemMasterSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemCategory',
      required: true
    },

    categoryName: { type: String, trim: true },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemCategory',
      default: null
    },

    subCategoryName: { type: String, trim: true },

    // Item Details
    manufacturer: { type: String, trim: true },
    brand: { type: String, trim: true },
    unit: { type: String, enum: ['piece', 'box', 'strip', 'bottle', 'vial', 'ampoule', 'ml', 'gm', 'kg', 'liter'], default: 'piece' },
    unitSize: { type: String, trim: true },

    // Pricing
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    // Stock
    currentStock: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    maximumStock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    reorderQuantity: { type: Number, default: 0 },

    // Batches
    batches: [batchSchema],
    batchManaged: { type: Boolean, default: false },

    // Location
    storageLocation: { type: String, trim: true },
    rackNumber: { type: String, trim: true },

    // Prescription Requirements
    requiresPrescription: { type: Boolean, default: false },
    isControlled: { type: Boolean, default: false },
    schedule: { type: String, trim: true },

    // Additional Info
    description: { type: String, trim: true },
    sideEffects: { type: String, trim: true },
    contraindications: { type: String, trim: true },
    storageInstructions: { type: String, trim: true },

    // Images
    images: [{ type: String, trim: true }],

    // Status
    status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Auto-generate item ID before saving
itemMasterSchema.pre('save', async function (next) {
  if (!this.itemId) {
    const lastItem = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    let lastId = 0;
    if (lastItem && lastItem.itemId) {
      const match = lastItem.itemId.match(/ITM-(\d+)/);
      if (match) {
        lastId = parseInt(match[1]);
      }
    }
    this.itemId = `ITM-${String(lastId + 1).padStart(6, '0')}`;
  }
  next();
});

const ItemMasterModel = (connection) => {
  return connection.models.ItemMaster || connection.model('ItemMaster', itemMasterSchema);
};

module.exports = ItemMasterModel;