// server/models/Clinic.js
const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tenantId: { 
      type: String, 
      unique: true, 
      index: true,
      required: true 
    }, // Tenant ID in format CLINIC000001
    registrationNumber: { type: String, trim: true },
    gstin: { type: String, uppercase: true, trim: true },
    type: {
      type: String,
      enum: ['General', 'Specialty', 'Multi-Specialty', 'Hospital'],
      default: 'General',
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    contact: {
      phone: String,
      email: String,
      website: String,
    },
    departments: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    settings: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      appointmentDuration: { type: Number, default: 15 }, // minutes
      workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Clinic', clinicSchema);