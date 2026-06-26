const mongoose = require('mongoose');

const vitalSchema = new mongoose.Schema(
  {
    recordedAt: {
      type: Date,
      default: Date.now,
    },

    temperature: {
      type: String,
      default: '',
    },

    pulse: {
      type: String,
      default: '',
    },

    respiratoryRate: {
      type: String,
      default: '',
    },

    spo2: {
      type: String,
      default: '',
    },

    bpSystolic: {
      type: String,
      default: '',
    },

    bpDiastolic: {
      type: String,
      default: '',
    },

    bloodSugar: {
      type: String,
      default: '',
    },

    height: {
      type: String,
      default: '',
    },

    weight: {
      type: String,
      default: '',
    },

    bmi: {
      type: String,
      default: '',
    },

    painScore: {
      type: String,
      default: '',
    },

    notes: {
      type: String,
      default: '',
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },

    recordedByName: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const nursingNoteSchema = new mongoose.Schema(
  {
    noteDate: {
      type: Date,
      default: Date.now,
    },

    shift: {
      type: String,
      enum: ['morning', 'afternoon', 'night', 'general'],
      default: 'general',
    },

    category: {
      type: String,
      enum: [
        'general',
        'medication',
        'procedure',
        'food',
        'activity',
        'incident',
        'other',
      ],
      default: 'general',
    },

    note: {
      type: String,
      required: true,
      trim: true,
    },

    actionTaken: {
      type: String,
      default: '',
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },

    recordedByName: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const doctorRoundSchema = new mongoose.Schema(
  {
    roundDate: {
      type: Date,
      default: Date.now,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },

    doctorName: {
      type: String,
      default: '',
    },

    complaints: {
      type: String,
      default: '',
    },

    examination: {
      type: String,
      default: '',
    },

    diagnosis: {
      type: String,
      default: '',
    },

    treatmentPlan: {
      type: String,
      default: '',
    },

    medicationChanges: {
      type: String,
      default: '',
    },

    investigationAdvice: {
      type: String,
      default: '',
    },

    followUpInstructions: {
      type: String,
      default: '',
    },

    nextRoundDate: {
      type: Date,
    },
  },
  { _id: true }
);

const labOrderTestSchema = new mongoose.Schema(
  {
    testName: {
      type: String,
      required: true,
      trim: true,
    },

    testCode: {
      type: String,
      default: '',
      trim: true,
    },

    sampleType: {
      type: String,
      default: '',
    },

    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine',
    },

    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        'ordered',
        'sample_collected',
        'processing',
        'completed',
        'cancelled',
      ],
      default: 'ordered',
    },

    result: {
      type: String,
      default: '',
    },

    resultDate: {
      type: Date,
    },
  },
  { _id: true }
);

const labOrderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      trim: true,
    },

    orderedAt: {
      type: Date,
      default: Date.now,
    },

    orderedByName: {
      type: String,
      default: '',
    },

    tests: {
      type: [labOrderTestSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        'ordered',
        'sample_collected',
        'processing',
        'completed',
        'cancelled',
      ],
      default: 'ordered',
    },

    notes: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const medicineIssueItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
    },

    itemId: String,
    itemName: String,
    batchNo: String,

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    unit: {
      type: String,
      default: '',
    },

    price: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const medicineIssueSchema = new mongoose.Schema(
  {
    issueNo: {
      type: String,
      required: true,
      trim: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    issuedByName: {
      type: String,
      default: '',
    },

    items: {
      type: [medicineIssueItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['issued', 'returned', 'cancelled'],
      default: 'issued',
    },

    notes: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const ipdChargeSchema = new mongoose.Schema(
  {
    chargeDate: {
      type: Date,
      default: Date.now,
    },

    chargeType: {
      type: String,
      enum: [
        'bed',
        'doctor',
        'nursing',
        'lab',
        'medicine',
        'procedure',
        'equipment',
        'misc',
      ],
      default: 'misc',
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 1,
    },

    rate: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },

    referenceType: {
      type: String,
      default: '',
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    addedByName: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const finalSettlementSchema = new mongoose.Schema(
  {
    totalCharges: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    advancePaid: {
      type: Number,
      default: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
    },

    balanceAmount: {
      type: Number,
      default: 0,
    },

    paymentMode: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank', 'insurance', 'mixed', 'other'],
      default: 'cash',
    },

    paymentReference: {
      type: String,
      default: '',
    },

    settledAt: {
      type: Date,
    },

    settledByName: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['pending', 'partial', 'settled'],
      default: 'pending',
    },
  },
  { _id: false }
);

const dischargeSummarySchema = new mongoose.Schema(
  {
    summaryDate: {
      type: Date,
    },

    finalDiagnosis: {
      type: String,
      default: '',
    },

    hospitalCourse: {
      type: String,
      default: '',
    },

    treatmentGiven: {
      type: String,
      default: '',
    },

    conditionOnDischarge: {
      type: String,
      default: '',
    },

    dischargeAdvice: {
      type: String,
      default: '',
    },

    followUpDate: {
      type: Date,
    },

    preparedByName: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['draft', 'completed'],
      default: 'draft',
    },
  },
  { _id: false }
);

const ipdAdmissionSchema = new mongoose.Schema(
  {
    admissionNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },

    patientId: String,
    patientName: String,
    phone: String,
    age: String,
    gender: String,

    visitId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    tokenNumber: String,
    departmentName: String,
    doctorName: String,

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      required: true,
    },

    wardName: String,

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },

    roomNumber: String,

    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: true,
    },

    bedNumber: String,

    admissionType: {
      type: String,
      enum: ['ipd', 'day_care', 'observation', 'emergency'],
      default: 'ipd',
    },

    admissionDate: {
      type: Date,
      default: Date.now,
    },

    expectedDischargeDate: {
      type: Date,
    },

    reasonForAdmission: {
      type: String,
      default: '',
    },

    consultantDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },

    consultantDoctorName: {
      type: String,
      default: '',
    },

    vitals: {
      type: [vitalSchema],
      default: [],
    },

    nursingNotes: {
      type: [nursingNoteSchema],
      default: [],
    },

    doctorRounds: {
      type: [doctorRoundSchema],
      default: [],
    },

    labOrders: {
      type: [labOrderSchema],
      default: [],
    },

    medicineIssues: {
      type: [medicineIssueSchema],
      default: [],
    },

    charges: {
      type: [ipdChargeSchema],
      default: [],
    },

    dischargeSummaryDetails: {
      type: dischargeSummarySchema,
      default: {},
    },

    finalSettlement: {
      type: finalSettlementSchema,
      default: {},
    },

    status: {
      type: String,
      enum: [
        'admitted',
        'discharge_summary_prepared',
        'settlement_pending',
        'settled',
        'bed_released',
        'discharged',
        'cancelled',
      ],
      default: 'admitted',
    },

    dischargeDate: {
      type: Date,
    },

    dischargeSummary: {
      type: String,
      default: '',
    },

    dischargeAdvice: {
      type: String,
      default: '',
    },

    bedReleasedAt: {
      type: Date,
    },

    bedReleasedByName: {
      type: String,
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

ipdAdmissionSchema.index({ patient: 1, status: 1 });
ipdAdmissionSchema.index({ bed: 1, status: 1 });
ipdAdmissionSchema.index({ admissionNo: 1 });

ipdAdmissionSchema.pre('validate', async function (next) {
  if (!this.admissionNo) {
    const count = await this.constructor.countDocuments();
    this.admissionNo = `IPD-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

const IpdAdmissionModel = (connection) => {
  return (
    connection.models.IpdAdmission ||
    connection.model('IpdAdmission', ipdAdmissionSchema)
  );
};

module.exports = IpdAdmissionModel;