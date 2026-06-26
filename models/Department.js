const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    specializationName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);



module.exports = mongoose.model('Department', departmentSchema);