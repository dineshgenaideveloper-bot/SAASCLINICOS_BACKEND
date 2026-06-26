const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    bedId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      required: true,
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },

    bedNumber: {
      type: String,
      required: true,
      trim: true,
    },

    bedType: {
      type: String,
      enum: ['standard', 'electric', 'icu', 'pediatric', 'maternity', 'emergency', 'other'],
      default: 'standard',
    },

    dailyCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance', 'inactive'],
      default: 'available',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

bedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });

bedSchema.pre('validate', async function (next) {
  if (!this.bedId) {
    const count = await this.constructor.countDocuments();
    this.bedId = `BED-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

const BedModel = (connection) => {
  return connection.models.Bed || connection.model('Bed', bedSchema);
};

module.exports = BedModel;