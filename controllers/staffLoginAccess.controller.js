// staffLoginAccess.controller.js - Updated getStaffLoginAccess

const User = require('../models/User');
const Clinic = require('../models/Clinic');
const StaffModel = require('../models/tenant/Staff');
const Feature = require('../models/Feature');

const getStaffModel = (req) => {
  if (!req.tenantDb) {
    throw new Error('Tenant DB connection not found');
  }
  return StaffModel(req.tenantDb);
};

const allowedRoles = ['doctor', 'nurse', 'receptionist', 'billing'];

const normalizeFeatureIds = async (features = []) => {
  if (!Array.isArray(features) || features.length === 0) return [];
  const validFeatures = await Feature.find({
    _id: { $in: features },
    isActive: true,
  }).select('_id');
  return validFeatures.map((item) => item._id);
};

exports.getStaffLoginAccess = async (req, res, next) => {
  try {
    const Staff = getStaffModel(req);
    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      hasAccess,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // First, get staff with filters
    const staffFilter = {};
    
    // Search filter for staff
    if (search) {
      staffFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { staffId: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get staff list with pagination
    const staffList = await Staff.find(staffFilter)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .lean();
    
    const totalStaff = await Staff.countDocuments(staffFilter);

    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: pageNumber,
          limit: limitNumber,
          totalPages: 0,
        },
      });
    }

    const staffIds = staffList.map((staff) => staff._id);

    // Get users for these staff
    let userQuery = User.find({
      _id: { $in: staffIds },
      tenantId: req.user.tenantId,
    })
      .select('name email role features isActive lastLogin createdAt')
      .populate('features', 'featureCode name module path icon textLink price')
      .lean();

    // Apply role filter on users
    if (role) {
      userQuery = userQuery.where('role', role);
    }

    // Apply status filter on users (only for users that exist)
    if (status) {
      userQuery = userQuery.where('isActive', status === 'active');
    }

    let users = await userQuery;
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    // Filter based on hasAccess
    let data = staffList.map((staff) => ({
      ...staff,
      loginUser: userMap.get(String(staff._id)) || null,
      hasLoginAccess: userMap.has(String(staff._id)),
    }));

    // Apply hasAccess filter after mapping
    if (hasAccess === 'has') {
      data = data.filter(item => item.hasLoginAccess);
    } else if (hasAccess === 'no') {
      data = data.filter(item => !item.hasLoginAccess);
    }

    // Apply status filter for users that don't have access
    if (status === 'active' || status === 'inactive') {
      const statusBool = status === 'active';
      data = data.filter(item => 
        !item.hasLoginAccess || (item.loginUser && item.loginUser.isActive === statusBool)
      );
    }

    // Note: Total count for pagination is tricky with post-filtering
    // For production, consider a more efficient approach with aggregation pipeline
    res.status(200).json({
      success: true,
      data,
      pagination: {
        total: totalStaff,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalStaff / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Rest of the controller remains the same...
exports.createStaffLoginAccess = async (req, res, next) => {
  try {
    const { staffId, password, role, features = [] } = req.body;

    if (!staffId || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Staff, password and role are required',
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    const Staff = getStaffModel(req);
    const staff = await Staff.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    if (staff.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Inactive staff cannot get login access',
      });
    }

    if (!staff.email) {
      return res.status(400).json({
        success: false,
        message: 'Staff email is required',
      });
    }

    const existingUserById = await User.findOne({
      _id: staff._id,
      tenantId: req.user.tenantId,
    });

    if (existingUserById) {
      return res.status(409).json({
        success: false,
        message: 'Login access already exists for this staff',
      });
    }

    const existingUserByEmail = await User.findOne({
      email: staff.email.toLowerCase(),
    });

    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already used by another user',
      });
    }

    const clinic = await Clinic.findOne({
      tenantId: req.user.tenantId,
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const featureIds = await normalizeFeatureIds(features);

    const user = await User.create({
      _id: staff._id,
      name: staff.name,
      email: staff.email.toLowerCase(),
      password,
      role,
      features: featureIds,
      clinic: clinic._id,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Staff login access created',
      data: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStaffLoginAccess = async (req, res, next) => {
  try {
    const { role, isActive, password, features } = req.body;

    const user = await User.findOne({
      _id: req.params.staffId,
      tenantId: req.user.tenantId,
    }).select('+password +refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Login user not found',
      });
    }

    if (role) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role',
        });
      }
      user.role = role;
    }

    if (Array.isArray(features)) {
      user.features = await normalizeFeatureIds(features);
    }

    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }

    if (password) {
      user.password = password;
      user.refreshTokens = [];
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('name email role features isActive lastLogin createdAt')
      .populate('features', 'featureCode name module path icon textLink price');

    res.status(200).json({
      success: true,
      message: 'Login access updated',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteStaffLoginAccess = async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({
      _id: req.params.staffId,
      tenantId: req.user.tenantId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Login user not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login access removed',
    });
  } catch (error) {
    next(error);
  }
};