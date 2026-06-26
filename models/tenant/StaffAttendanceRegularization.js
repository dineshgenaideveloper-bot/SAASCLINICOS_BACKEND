import mongoose from 'mongoose';

const staffAttendanceRegularizationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    clinicId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffAttendance',
      index: true,
    },

    attendanceDate: {
      type: String,
      required: true,
      index: true,
    },

    requestType: {
      type: String,
      enum: [
        'missing_check_in',
        'missing_check_out',
        'time_correction',
        'full_day',
        'status_change',
        'other',
      ],
      default: 'time_correction',
      index: true,
    },

    requestedCheckInTime: {
      type: Date,
    },

    requestedCheckOutTime: {
      type: Date,
    },

    requestedStatus: {
      type: String,
      enum: ['checked_in', 'present', 'absent', 'rejected'],
      default: 'present',
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    employeeNotes: {
      type: String,
      trim: true,
    },

    adminNotes: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },

    source: {
      type: String,
      enum: ['my_attendance', 'staff_attendance'],
      default: 'my_attendance',
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    requestedByName: {
      type: String,
      trim: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    reviewedByName: {
      type: String,
      trim: true,
    },

    reviewedAt: {
      type: Date,
    },

    appliedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

staffAttendanceRegularizationSchema.index({
  tenantId: 1,
  clinicId: 1,
  staff: 1,
  attendanceDate: 1,
  status: 1,
});

export default mongoose.models.StaffAttendanceRegularization ||
  mongoose.model(
    'StaffAttendanceRegularization',
    staffAttendanceRegularizationSchema
  );