const mongoose = require('mongoose');

const maintenanceLogSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  cost: { type: String, trim: true },
  performedBy: { type: String, trim: true },
  nextDueDate: Date,
  notes: { type: String, trim: true }
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  url: { type: String, trim: true },
  type: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
});

const assetSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetCategory' },
    
    // Asset Details
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    supplier: { type: String, trim: true },
    
    // Purchase Information
    purchaseDate: Date,
    purchaseCost: { type: String, trim: true },
    warrantyExpiryDate: Date,
    invoiceNumber: { type: String, trim: true },
    
    // Location & Assignment
    location: { type: String, trim: true },
    assignedTo: { type: String, trim: true },
    assignedType: { type: String, enum: ['staff', 'department', 'none'], default: 'none' },
    
    // Status & Maintenance
    status: {
      type: String,
      enum: ['active', 'maintenance', 'retired', 'disposed'],
      default: 'active'
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
      default: 'good'
    },
    
    // Maintenance
    lastMaintenanceDate: Date,
    nextMaintenanceDate: Date,
    maintenanceFrequency: { type: String, trim: true },
    maintenanceLogs: [maintenanceLogSchema],
    
    // Documentation
    documents: [documentSchema],
    
    // Additional Info
    notes: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    
    // Depreciation
    depreciationMethod: { type: String, trim: true },
    depreciationRate: { type: String, trim: true },
    currentValue: { type: String, trim: true },
    
    // Insurance
    insuranceProvider: { type: String, trim: true },
    insurancePolicyNumber: { type: String, trim: true },
    insuranceExpiryDate: Date,
    
    // QR/Barcode
    qrCode: { type: String, trim: true },
    barcode: { type: String, trim: true, unique: true, sparse: true },
    
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Auto-generate asset ID before saving
assetSchema.pre('save', async function(next) {
  if (!this.assetId) {
    const lastAsset = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    let lastId = 0;
    if (lastAsset && lastAsset.assetId) {
      const match = lastAsset.assetId.match(/AST-(\d+)/);
      if (match) {
        lastId = parseInt(match[1]);
      }
    }
    this.assetId = `AST-${String(lastId + 1).padStart(4, '0')}`;
  }
  next();
});

const AssetModel = (connection) => {
  return connection.models.Asset || connection.model('Asset', assetSchema);
};

module.exports = AssetModel;