const mongoose = require('mongoose');

const itemCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },

    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemCategory',
      default: null
    },

    description: { type: String, trim: true },
    hsnCode: { type: String, trim: true },
    gstRate: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    reorderQuantity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    color: { type: String, default: '#3b82f6' }
  },
  { timestamps: true }
);

itemCategorySchema.index({ code: 1 }, { unique: true });

const ItemCategoryModel = (connection) => {
  return connection.models.ItemCategory || connection.model('ItemCategory', itemCategorySchema);
};

module.exports = ItemCategoryModel;