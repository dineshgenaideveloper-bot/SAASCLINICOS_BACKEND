const mongoose = require('mongoose');

const loginPriceSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'LoginPrice',
  loginPriceSchema
);