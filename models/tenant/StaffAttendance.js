import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    time: {
      type: Date,
      required: true,
    },

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    distanceMeters: {
      type: Number,
    },

    insideRadius: {
      type: Boolean,
    },

    source: {
      type: String,
      enum: ['gps', 'regularized'],
      default: 'gps',
    },
  },
  { _id: false }
);

const staffAttendanceSchema = new mongoose.Schema(
  {
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

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    attendanceDate: {
      type: String,
      required: true,
      index: true,
    },

    checkIn: locationSchema,

    checkOut: locationSchema,

    workedMinutes: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['checked_in', 'present', 'absent', 'rejected'],
      default: 'checked_in',
      index: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    isRegularized: {
      type: Boolean,
      default: false,
      index: true,
    },

    regularizedAt: {
      type: Date,
    },

    regularizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    regularizationRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffAttendanceRegularization',
    },
  },
  { timestamps: true }
);

staffAttendanceSchema.index(
  { tenantId: 1, clinicId: 1, staff: 1, attendanceDate: 1 },
  { unique: true }
);

staffAttendanceSchema.index({ tenantId: 1, clinicId: 1, attendanceDate: -1 });
staffAttendanceSchema.index({ tenantId: 1, clinicId: 1, status: 1 });
staffAttendanceSchema.index({ tenantId: 1, clinicId: 1, isRegularized: 1 });

export default mongoose.models.StaffAttendance ||
  mongoose.model('StaffAttendance', staffAttendanceSchema);