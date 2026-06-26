const mongoose = require('mongoose');

const patientTokenSchema = new mongoose.Schema(
  {
    tokenNumber: { type: String, required: true, trim: true },
    tokenSeq: { type: Number, required: true },

    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, trim: true },
    patientId: {  // New field to reference existing patient
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },

    departmentName: { type: String, trim: true },
    departmentCode: { type: String, trim: true },
    specializationName: { type: String, trim: true },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },

    staffName: { type: String, trim: true },
    staffId: { type: String, trim: true },
    staffPhone: { type: String, trim: true },
    staffRole: { type: String, trim: true },

    tokenDate: { type: String, required: true },

    status: {
      type: String,
      enum: ['waiting', 'called', 'completed', 'cancelled'],
      default: 'waiting',
    },

    notes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

patientTokenSchema.index(
  { department: 1, tokenDate: 1, tokenSeq: 1 },
  { unique: true }
);

const PatientTokenModel = (connection) => {
  return (
    connection.models.PatientToken ||
    connection.model('PatientToken', patientTokenSchema)
  );
};

module.exports = PatientTokenModel;