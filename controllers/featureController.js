// featureController.js - Updated with pagination

const Feature = require('../models/Feature');

// GET all features with pagination
exports.getFeatures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      module,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { featureCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { module: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    // Module filter
    if (module) {
      filter.module = { $regex: `^${module}$`, $options: 'i' };
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [features, total] = await Promise.all([
      Feature.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Feature.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: features,
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
      message: 'Failed to fetch features',
      error: error.message,
    });
  }
};

// GET single feature
exports.getFeatureById = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    res.json({
      success: true,
      data: feature,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature',
      error: error.message,
    });
  }
};

// CREATE feature
exports.createFeature = async (req, res) => {
  try {
    // Check for duplicate feature code
    const existingFeature = await Feature.findOne({ 
      featureCode: req.body.featureCode.toUpperCase() 
    });
    
    if (existingFeature) {
      return res.status(400).json({
        success: false,
        message: 'Feature code already exists',
      });
    }

    const feature = await Feature.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Feature created successfully',
      data: feature,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create feature',
      error: error.message,
    });
  }
};

// UPDATE feature
exports.updateFeature = async (req, res) => {
  try {
    const feature = await Feature.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    res.json({
      success: true,
      message: 'Feature updated successfully',
      data: feature,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update feature',
      error: error.message,
    });
  }
};

// DELETE feature
exports.deleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findByIdAndDelete(req.params.id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    res.json({
      success: true,
      message: 'Feature deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete feature',
      error: error.message,
    });
  }
};

// ACTIVE / INACTIVE toggle
exports.updateFeatureStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be true or false',
      });
    }

    const feature = await Feature.findByIdAndUpdate(
      req.params.id,
      { isActive },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    res.json({
      success: true,
      message: `Feature ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: feature,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update feature status',
      error: error.message,
    });
  }
};