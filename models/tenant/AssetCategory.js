const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  description: { type: String, trim: true },
  depreciationRate: { type: String, trim: true },
  usefulLifeYears: { type: Number },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const assetCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    parentCategory: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'AssetCategory',
      default: null 
    },
    subCategories: [subCategorySchema],
    depreciationRate: { type: String, trim: true },
    depreciationMethod: { 
      type: String, 
      enum: ['straight-line', 'diminishing-balance', 'none'],
      default: 'straight-line'
    },
    usefulLifeYears: { type: Number, default: 5 },
    icon: { type: String, trim: true },
    color: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Virtual for getting all subcategories as simple array
assetCategorySchema.virtual('subCategoryList').get(function() {
  return this.subCategories.map(sub => sub.name);
});

const AssetCategoryModel = (connection) => {
  return connection.models.AssetCategory || connection.model('AssetCategory', assetCategorySchema);
};

module.exports = AssetCategoryModel;