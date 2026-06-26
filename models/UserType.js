const mongoose = require('mongoose');

const userTypeSchema = new mongoose.Schema(
  {
    userTypeName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    icon: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserType', userTypeSchema);