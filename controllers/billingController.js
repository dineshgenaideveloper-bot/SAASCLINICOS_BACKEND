// billingController.js - Updated with tenant filtering

const Billing = require('../models/Billing');

// GET all billings with pagination and tenant filter
exports.getBillings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      tenantId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Tenant filter (for non-admin users)
    if (tenantId) {
      filter.tenantId = tenantId;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
        filter.createdAt.$gte.setHours(0, 0, 0, 0);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
        filter.createdAt.$lte.setHours(23, 59, 59, 999);
      }
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [billings, total] = await Promise.all([
      Billing.find(filter)
        .populate('clinic', 'name tenantId')
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Billing.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: billings,
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
      message: 'Failed to fetch billings',
      error: error.message,
    });
  }
};

// UPDATE billing status
exports.updateBillingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const billing = await Billing.findByIdAndUpdate(
      req.params.id,
      { status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing not found',
      });
    }

    res.json({
      success: true,
      message: 'Billing status updated successfully',
      data: billing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update billing status',
      error: error.message,
    });
  }
};