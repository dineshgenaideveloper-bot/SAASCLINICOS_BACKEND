// userTypeController.js - Updated with pagination

const UserType = require('../models/UserType');

// GET with pagination
exports.getUserTypes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { userTypeName: { $regex: search, $options: 'i' } },
        { icon: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [userTypes, total] = await Promise.all([
      UserType.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      UserType.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: userTypes,
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
      message: 'Failed to fetch user types',
      error: error.message,
    });
  }
};

// CREATE
exports.createUserType = async (req, res) => {
  try {
    // Check for duplicate user type name
    const existingUserType = await UserType.findOne({ 
      userTypeName: { $regex: `^${req.body.userTypeName}$`, $options: 'i' } 
    });
    
    if (existingUserType) {
      return res.status(400).json({
        success: false,
        message: 'User type name already exists',
      });
    }

    const userType = await UserType.create(req.body);

    res.status(201).json({
      success: true,
      message: 'User type created successfully',
      data: userType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create user type',
      error: error.message,
    });
  }
};

// UPDATE
exports.updateUserType = async (req, res) => {
  try {
    // Check for duplicate user type name (excluding current one)
    const existingUserType = await UserType.findOne({
      userTypeName: { $regex: `^${req.body.userTypeName}$`, $options: 'i' },
      _id: { $ne: req.params.id }
    });
    
    if (existingUserType) {
      return res.status(400).json({
        success: false,
        message: 'User type name already exists',
      });
    }

    const userType = await UserType.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!userType) {
      return res.status(404).json({
        success: false,
        message: 'User type not found',
      });
    }

    res.json({
      success: true,
      message: 'User type updated successfully',
      data: userType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user type',
      error: error.message,
    });
  }
};

// DELETE
exports.deleteUserType = async (req, res) => {
  try {
    const userType = await UserType.findByIdAndDelete(req.params.id);

    if (!userType) {
      return res.status(404).json({
        success: false,
        message: 'User type not found',
      });
    }

    res.json({
      success: true,
      message: 'User type deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user type',
      error: error.message,
    });
  }
};

// STATUS
exports.updateUserTypeStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be true or false',
      });
    }

    const userType = await UserType.findByIdAndUpdate(
      req.params.id,
      { isActive },
      {
        new: true,
      }
    );

    if (!userType) {
      return res.status(404).json({
        success: false,
        message: 'User type not found',
      });
    }

    res.json({
      success: true,
      message: `User type ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: userType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message,
    });
  }
};