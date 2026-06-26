import mongoose from 'mongoose';

const staffAttendanceConfigSchema = new mongoose.Schema(
  {
    // SaaS scope. Map these values from your auth/tenant middleware.
    tenantId: {
      type: String,
      required: true,
      default: 'default',
      trim: true,
      index: true,
    },
    clinicId: {
      type: String,
      required: true,
      default: 'default',
      trim: true,
      index: true,
    },

    clinicName: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    radiusMeters: {
      type: Number,
      default: 100,
      min: 1,
      max: 5000,
    },
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    requireLocation: {
      type: Boolean,
      default: true,
    },
    allowCheckoutOutsideRadius: {
      type: Boolean,
      default: false,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedByName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

staffAttendanceConfigSchema.index({ tenantId: 1, clinicId: 1 }, { unique: true });

export default mongoose.model('StaffAttendanceConfig', staffAttendanceConfigSchema);
