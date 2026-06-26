const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema(
  {
    featureCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },

    path: {
      type: String,
      required: true,
      trim: true,
    },

    icon: {
      type: String,
      trim: true,
    },

    textLink: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      default: 0,
    },

    description: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feature', featureSchema);