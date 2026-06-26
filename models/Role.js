const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
      trim: true,
    },
    roleCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);