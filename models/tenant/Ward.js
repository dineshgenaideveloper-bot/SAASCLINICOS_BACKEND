const mongoose = require('mongoose');

const wardSchema = new mongoose.Schema(
  {
    wardId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
    },

    speciality: {
      type: String,
      trim: true,
    },

    wardType: {
      type: String,
      enum: ['general', 'private', 'semi_private', 'icu', 'nicu', 'picu', 'emergency', 'maternity', 'other'],
      default: 'general',
    },

    floor: {
      type: String,
      trim: true,
    },

    genderType: {
      type: String,
      enum: ['male', 'female', 'unisex', 'other'],
      default: 'unisex',
    },

    description: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

wardSchema.pre('validate', async function (next) {
  if (!this.wardId) {
    const count = await this.constructor.countDocuments();
    this.wardId = `WRD-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

const WardModel = (connection) => {
  return connection.models.Ward || connection.model('Ward', wardSchema);
};

module.exports = WardModel;