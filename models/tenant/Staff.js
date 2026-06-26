const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  companyName: { type: String, trim: true },
  designation: { type: String, trim: true },
  fromDate: Date,
  toDate: Date,
  yearsOfExperience: { type: String, trim: true },
  salary: { type: String, trim: true },
  address: { type: String, trim: true },
  phone: { type: String, trim: true },
});

const staffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      unique: true,
      trim: true,
    },

    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    gender: { type: String, trim: true },
    dob: Date,

    departments: [{ type: String, trim: true }],
    role: { type: String, required: true, trim: true },

    degrees: [{ type: String, trim: true }],
    qualificationDetails: { type: String, trim: true },

    staffType: {
      type: String,
      enum: ['Fresher', 'Experienced'],
      default: 'Fresher',
    },

    experiences: [experienceSchema],

    aadhaarNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    esiNumber: { type: String, trim: true },
    pfNumber: { type: String, trim: true },
    uanNumber: { type: String, trim: true },

    bankName: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    branchName: { type: String, trim: true },

    salary: { type: String, trim: true },
    joiningDate: Date,
    address: { type: String, trim: true },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

staffSchema.pre('save', async function (next) {
  try {
    if (!this.staffId) {
      const lastStaff = await this.constructor.findOne(
        { staffId: { $regex: /^STF-\d+$/ } },
        {},
        { sort: { createdAt: -1 } }
      );

      let lastId = 0;

      if (lastStaff?.staffId) {
        const match = lastStaff.staffId.match(/STF-(\d+)/);
        if (match) lastId = Number(match[1]) || 0;
      }

      this.staffId = `STF-${String(lastId + 1).padStart(4, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const StaffModel = (connection) => {
  return connection.models.Staff || connection.model('Staff', staffSchema);
};

module.exports = StaffModel;