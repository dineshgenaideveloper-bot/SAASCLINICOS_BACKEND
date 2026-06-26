const PatientTokenModel = require('../../models/tenant/PatientToken');
const StaffModel = require('../../models/tenant/Staff');
const PatientModel = require('../../models/tenant/Patient');

const getToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getLoggedUserId = (req) => {
  return (
    req.query.userId ||
    req.body.userId ||
    req.user?._id ||
    req.user?.id ||
    ''
  );
};

const getLoggedStaff = async (req) => {
  const Staff = StaffModel(req.tenantDb);
  const userId = getLoggedUserId(req);

  if (!userId) return null;

  return Staff.findOne({
    _id: userId,
    status: 'active',
  });
};

exports.getMyDoctorTokens = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);

    const { date = getToday(), status } = req.query;

    const staffDoc = await getLoggedStaff(req);

    if (!staffDoc) {
      return res.json({
        success: true,
        data: {
          staff: null,
          tokens: [],
          stats: {
            total: 0,
            waiting: 0,
            called: 0,
            completed: 0,
            cancelled: 0,
          },
          message: 'No staff/doctor linked to this logged-in user ID',
        },
      });
    }

    const baseFilter = {
      tokenDate: date,
      staff: staffDoc._id,
    };

    const listFilter = {
      ...baseFilter,
      status: status || { $in: ['waiting', 'called'] },
    };

    const tokens = await PatientToken.find(listFilter).sort({
      status: 1,
      tokenSeq: 1,
      createdAt: 1,
    });

    const stats = {
      total: await PatientToken.countDocuments(baseFilter),
      waiting: await PatientToken.countDocuments({
        ...baseFilter,
        status: 'waiting',
      }),
      called: await PatientToken.countDocuments({
        ...baseFilter,
        status: 'called',
      }),
      completed: await PatientToken.countDocuments({
        ...baseFilter,
        status: 'completed',
      }),
      cancelled: await PatientToken.countDocuments({
        ...baseFilter,
        status: 'cancelled',
      }),
    };

    res.json({
      success: true,
      data: {
        staff: staffDoc,
        tokens,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.callToken = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);
    const staffDoc = await getLoggedStaff(req);

    if (!staffDoc) {
      return res.status(403).json({
        success: false,
        message: 'No staff/doctor linked to this logged-in user ID',
      });
    }

    const token = await PatientToken.findOneAndUpdate(
      {
        _id: req.params.id,
        staff: staffDoc._id,
        status: 'waiting',
      },
      { status: 'called' },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found, not waiting, or not assigned to you',
      });
    }

    res.json({
      success: true,
      data: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.completeToken = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);
    const Patient = PatientModel(req.tenantDb);

    const staffDoc = await getLoggedStaff(req);

    if (!staffDoc) {
      return res.status(403).json({
        success: false,
        message: 'No staff/doctor linked to this logged-in user ID',
      });
    }

    const token = await PatientToken.findOneAndUpdate(
      {
        _id: req.params.id,
        staff: staffDoc._id,
        status: 'called',
      },
      { status: 'completed' },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found, not called, or not assigned to you',
      });
    }

    const patientPhone = token.patientPhone?.trim();
    const patientId = token.patientId; // Reference to existing patient

    let patient = null;
    let isNew = false;
    let existingHabits = null;
    let existingGeneralEnquiry = null;
    let existingDepartmentForm = null;

    // If patientId exists, fetch existing patient
    if (patientId) {
      patient = await Patient.findById(patientId);
      
      if (patient) {
        // Get the last visit to pre-populate data
        const lastVisit = patient.visits && patient.visits.length > 0 
          ? patient.visits[patient.visits.length - 1] 
          : null;
        
        if (lastVisit) {
          existingHabits = lastVisit.habits || null;
          existingGeneralEnquiry = lastVisit.generalEnquiry || null;
          existingDepartmentForm = lastVisit.departmentForm || null;
        }
      }
    }

    // If no patient found by ID, try by phone number
    if (!patient && patientPhone) {
      patient = await Patient.findOne({ phone: patientPhone });
      
      if (patient) {
        // Get the last visit to pre-populate data
        const lastVisit = patient.visits && patient.visits.length > 0 
          ? patient.visits[patient.visits.length - 1] 
          : null;
        
        if (lastVisit) {
          existingHabits = lastVisit.habits || null;
          existingGeneralEnquiry = lastVisit.generalEnquiry || null;
          existingDepartmentForm = lastVisit.departmentForm || null;
        }
      }
    }

    const visitObject = {
      sourceToken: token._id,
      tokenNumber: token.tokenNumber,

      department: token.department,
      departmentName: token.departmentName,
      departmentCode: token.departmentCode,
      specializationName: token.specializationName,

      doctor: token.staff,
      doctorName: token.staffName,

      // For existing patient: pre-populate from last visit
      // For new patient: empty/default values
      habits: existingHabits || {
        smoking: '',
        alcohol: '',
        tobacco: '',
        foodType: '',
        sleep: '',
        exercise: '',
        allergies: '',
      },

      generalEnquiry: existingGeneralEnquiry || {
        chiefComplaint: '',
        duration: '',
        history: '',
        currentMedication: '',
        pastHistory: '',
        familyHistory: '',
        notes: token.notes || '',
      },

      departmentForm: existingDepartmentForm || {},

      status: 'enquiry',
      visitDate: new Date(),
    };

    if (!patient) {
      // Create NEW patient
      isNew = true;
      
      patient = await Patient.create({
        name: token.patientName,
        phone: patientPhone,
        patientId: token.patientId || null,
        age: token.age || '',
        gender: token.gender || '',
        address: token.address || '',
        visits: [visitObject],
      });
    } else {
      // Add visit to EXISTING patient
      // Check if this token's visit already exists
      const alreadyAdded = patient.visits?.some(
        (visit) => String(visit.sourceToken) === String(token._id)
      );

      if (!alreadyAdded) {
        patient.visits.push(visitObject);
        await patient.save();
      } else {
        // Update existing visit
        const visitIndex = patient.visits.findIndex(
          (visit) => String(visit.sourceToken) === String(token._id)
        );
        if (visitIndex !== -1) {
          patient.visits[visitIndex] = { ...patient.visits[visitIndex], ...visitObject };
          await patient.save();
        }
      }
    }

    res.json({
      success: true,
      message: isNew
        ? 'Token completed and new patient created'
        : 'Token completed and new visit added to existing patient',
      data: {
        token,
        patient,
        isNew,
        // Send pre-populated data if existing patient
        prePopulatedData: !isNew ? {
          habits: existingHabits,
          generalEnquiry: existingGeneralEnquiry,
          departmentForm: existingDepartmentForm,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error in completeToken:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.cancelToken = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);
    const staffDoc = await getLoggedStaff(req);

    if (!staffDoc) {
      return res.status(403).json({
        success: false,
        message: 'No staff/doctor linked to this logged-in user ID',
      });
    }

    const token = await PatientToken.findOneAndUpdate(
      {
        _id: req.params.id,
        staff: staffDoc._id,
        status: { $in: ['waiting', 'called'] },
      },
      { status: 'cancelled' },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found, already closed, or not assigned to you',
      });
    }

    res.json({
      success: true,
      data: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};