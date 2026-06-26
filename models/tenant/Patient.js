const mongoose = require('mongoose');

const prescriptionItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      required: true,
    },

    itemId: String,
    itemName: String,
    genericName: String,
    categoryName: String,

    dosage: {
      type: String,
      default: '',
    },

    frequency: {
      type: String,
      default: '',
    },

    timing: {
      type: String,
      default: '',
    },

    duration: {
      type: String,
      default: '',
    },

    quantity: {
      type: Number,
      default: 1,
    },

    instructions: {
      type: String,
      default: '',
    },

    price: {
      type: Number,
      default: 0,
    },
    morning: {
  beforeFood: { type: Boolean, default: false },
  afterFood: { type: Boolean, default: false },
},

afternoon: {
  beforeFood: { type: Boolean, default: false },
  afterFood: { type: Boolean, default: false },
},

evening: {
  beforeFood: { type: Boolean, default: false },
  afterFood: { type: Boolean, default: false },
},

night: {
  beforeFood: { type: Boolean, default: false },
  afterFood: { type: Boolean, default: false },
},

durationDays: {
  type: Number,
  default: 1,
},

durationEnglish: {
  type: String,
  default: '',
},

durationTamil: {
  type: String,
  default: '',
},
    
  },
  { _id: true }
);

const patientVisitSchema = new mongoose.Schema(
  {
    sourceToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientToken',
    },

    tokenNumber: String,

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },

    departmentName: String,
    departmentCode: String,
    specializationName: String,

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },

    doctorName: String,

    habits: {
      smoking: { type: String, default: '' },
      alcohol: { type: String, default: '' },
      tobacco: { type: String, default: '' },
      foodType: { type: String, default: '' },
      sleep: { type: String, default: '' },
      exercise: { type: String, default: '' },
      allergies: { type: String, default: '' },
    },

    generalEnquiry: {
      chiefComplaint: { type: String, default: '' },
      duration: { type: String, default: '' },
      history: { type: String, default: '' },
      currentMedication: { type: String, default: '' },
      pastHistory: { type: String, default: '' },
      familyHistory: { type: String, default: '' },
      notes: { type: String, default: '' },
    },

    departmentForm: {
      type: Object,
      default: {},
    },
    prescriptions: {
      type: [prescriptionItemSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ['enquiry', 'consulting', 'completed'],
      default: 'enquiry',
    },

    visitDate: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);



const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    age: {
      type: String,
      default: '',
    },

    gender: {
      type: String,
      default: '',
    },

    address: {
      type: String,
      default: '',
    },

    visits: {
      type: [patientVisitSchema],
      default: [],
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

patientSchema.pre('save', async function (next) {
  if (!this.patientId) {
    const lastPatient = await this.constructor
      .findOne({ patientId: { $regex: /^PAT-\d+$/ } })
      .sort({ createdAt: -1 });

    let lastId = 0;

    if (lastPatient?.patientId) {
      const match = lastPatient.patientId.match(/PAT-(\d+)/);
      if (match) lastId = Number(match[1]) || 0;
    }

    this.patientId = `PAT-${String(lastId + 1).padStart(5, '0')}`;
  }

  next();
});

const PatientModel = (connection) => {
  return connection.models.Patient || connection.model('Patient', patientSchema);
};

module.exports = PatientModel;