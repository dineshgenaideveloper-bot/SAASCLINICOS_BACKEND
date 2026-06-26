const PatientTokenModel = require('../../models/tenant/PatientToken');
const StaffModel = require('../../models/tenant/Staff');
const Department = require('../../models/Department');

const getToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

exports.getPatientTokens = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);

    const {
      date,
      status,
      department,
      staff,
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (date) filter.tokenDate = date;
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (staff) filter.staff = staff;

    if (search) {
      filter.$or = [
        { tokenNumber: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { patientPhone: { $regex: search, $options: 'i' } },
        { departmentName: { $regex: search, $options: 'i' } },
        { staffName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const [tokens, total] = await Promise.all([
      PatientToken.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber),
      PatientToken.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: tokens,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createPatientToken = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);
    const Staff = StaffModel(req.tenantDb);
    
    const {
      patientId,      // New field for existing patient
      patientName,
      patientPhone,
      department,
      staff,
      notes,
    } = req.body;

    if (!patientName || !department) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and department are required',
      });
    }

    // If patientId is provided, verify patient exists (optional)
    if (patientId) {
      // You can add validation here if needed
      // const Patient = require('../../models/Patient')(req.tenantDb);
      // const patientExists = await Patient.findById(patientId);
      // if (!patientExists) {
      //   return res.status(404).json({ success: false, message: 'Patient not found' });
      // }
    }

    const departmentDoc = await Department.findById(department);

    if (!departmentDoc) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    let staffDoc = null;

    if (staff) {
      staffDoc = await Staff.findById(staff);

      if (!staffDoc) {
        return res.status(404).json({
          success: false,
          message: 'Staff not found',
        });
      }

      const assignedDepartments = Array.isArray(staffDoc.departments)
        ? staffDoc.departments.map(String)
        : staffDoc.department
          ? [String(staffDoc.department)]
          : [];

      if (!assignedDepartments.includes(String(department))) {
        return res.status(400).json({
          success: false,
          message: 'Selected staff is not assigned to this department',
        });
      }
    }

    const tokenDate = getToday();

    const lastToken = await PatientToken.findOne({
      department,
      tokenDate,
    }).sort({ tokenSeq: -1 });

    const tokenSeq = lastToken ? lastToken.tokenSeq + 1 : 1;

    const prefix =
      departmentDoc.code ||
      String(departmentDoc.name || 'TOK').slice(0, 3).toUpperCase();

    const tokenNumber = `${prefix}-${String(tokenSeq).padStart(3, '0')}`;

    const token = await PatientToken.create({
      tokenNumber,
      tokenSeq,

      patientName,
      patientPhone,
      patientId: patientId || null,  // Store patient reference if exists

      department: departmentDoc._id,
      departmentName: departmentDoc.name,
      departmentCode: departmentDoc.code,
      specializationName: departmentDoc.specializationName,

      staff: staffDoc?._id || null,
      staffName: staffDoc?.name || '',
      staffId: staffDoc?.staffId || '',
      staffPhone: staffDoc?.phone || '',
      staffRole: staffDoc?.role || '',

      tokenDate,
      status: 'waiting',
      notes,

      createdBy: req.user?.name || req.user?.email || 'System',
    });

    res.status(201).json({
      success: true,
      data: token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Token conflict. Please try again.',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePatientTokenStatus = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);

    const { status } = req.body;

    if (!['waiting', 'called', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token status',
      });
    }

    const token = await PatientToken.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found',
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

exports.deletePatientToken = async (req, res) => {
  try {
    const PatientToken = PatientTokenModel(req.tenantDb);

    const token = await PatientToken.findByIdAndDelete(req.params.id);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found',
      });
    }

    res.json({
      success: true,
      message: 'Token deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};