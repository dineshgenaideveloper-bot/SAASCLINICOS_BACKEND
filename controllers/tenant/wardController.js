const WardModel = require('../../models/tenant/Ward');

exports.getWards = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      wardType,
      speciality,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { wardId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { speciality: { $regex: search, $options: 'i' } },
        { floor: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (wardType) filter.wardType = wardType;
    if (speciality) filter.speciality = { $regex: `^${speciality}$`, $options: 'i' };

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [wards, total] = await Promise.all([
      Ward.find(filter).sort(sort).skip(skip).limit(limitNumber).lean(),
      Ward.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: wards,
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
      message: 'Failed to fetch wards',
      error: error.message,
    });
  }
};

exports.getWardById = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const ward = await Ward.findById(req.params.id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: 'Ward not found',
      });
    }

    res.json({
      success: true,
      data: ward,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ward',
      error: error.message,
    });
  }
};

exports.createWard = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const ward = await Ward.create(req.body);

    res.status(201).json({
      success: true,
      data: ward,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create ward',
      error: error.message,
    });
  }
};

exports.updateWard = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const ward = await Ward.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: 'Ward not found',
      });
    }

    res.json({
      success: true,
      data: ward,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update ward',
      error: error.message,
    });
  }
};

exports.deleteWard = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const ward = await Ward.findByIdAndDelete(req.params.id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: 'Ward not found',
      });
    }

    res.json({
      success: true,
      message: 'Ward deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete ward',
      error: error.message,
    });
  }
};

exports.updateWardStatus = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);

    const isActive = Boolean(req.body.isActive);

    const ward = await Ward.findByIdAndUpdate(
      req.params.id,
      {
        isActive,
        status: isActive ? 'active' : 'inactive',
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: 'Ward not found',
      });
    }

    res.json({
      success: true,
      data: ward,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update ward status',
      error: error.message,
    });
  }
};