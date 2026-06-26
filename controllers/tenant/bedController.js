const RoomModel = require('../../models/tenant/Room');
const BedModel = require('../../models/tenant/Bed');

exports.getBeds = async (req, res) => {
  try {
    const Bed = BedModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      ward,
      room,
      bedType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { bedId: { $regex: search, $options: 'i' } },
        { bedNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (ward) filter.ward = ward;
    if (room) filter.room = room;
    if (bedType) filter.bedType = bedType;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [beds, total] = await Promise.all([
      Bed.find(filter)
        .populate('ward', 'wardId name speciality wardType floor')
        .populate('room', 'roomId roomNumber name roomType floor')
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Bed.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: beds,
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
      message: 'Failed to fetch beds',
      error: error.message,
    });
  }
};

exports.getBedById = async (req, res) => {
  try {
    const Bed = BedModel(req.tenantDb);

    const bed = await Bed.findById(req.params.id)
      .populate('ward', 'wardId name speciality wardType floor')
      .populate('room', 'roomId roomNumber name roomType floor');

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found',
      });
    }

    res.json({
      success: true,
      data: bed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bed',
      error: error.message,
    });
  }
};

exports.createBed = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);
    const Bed = BedModel(req.tenantDb);

    const room = await Room.findById(req.body.room);

    if (!room) {
      return res.status(400).json({
        success: false,
        message: 'Valid room is required',
      });
    }

    const payload = {
      ...req.body,
      ward: room.ward,
    };

    const bed = await Bed.create(payload);

    const populatedBed = await Bed.findById(bed._id)
      .populate('ward', 'wardId name speciality wardType floor')
      .populate('room', 'roomId roomNumber name roomType floor');

    res.status(201).json({
      success: true,
      data: populatedBed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create bed',
      error: error.message,
    });
  }
};

exports.updateBed = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);
    const Bed = BedModel(req.tenantDb);

    const payload = { ...req.body };

    if (payload.room) {
      const room = await Room.findById(payload.room);

      if (!room) {
        return res.status(400).json({
          success: false,
          message: 'Valid room is required',
        });
      }

      payload.ward = room.ward;
    }

    const bed = await Bed.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    })
      .populate('ward', 'wardId name speciality wardType floor')
      .populate('room', 'roomId roomNumber name roomType floor');

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found',
      });
    }

    res.json({
      success: true,
      data: bed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update bed',
      error: error.message,
    });
  }
};

exports.deleteBed = async (req, res) => {
  try {
    const Bed = BedModel(req.tenantDb);

    const bed = await Bed.findByIdAndDelete(req.params.id);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found',
      });
    }

    res.json({
      success: true,
      message: 'Bed deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete bed',
      error: error.message,
    });
  }
};

exports.updateBedStatus = async (req, res) => {
  try {
    const Bed = BedModel(req.tenantDb);

    const { status } = req.body;

    const isActive = status !== 'inactive';

    const bed = await Bed.findByIdAndUpdate(
      req.params.id,
      {
        status,
        isActive,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate('ward', 'wardId name speciality wardType floor')
      .populate('room', 'roomId roomNumber name roomType floor');

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found',
      });
    }

    res.json({
      success: true,
      data: bed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update bed status',
      error: error.message,
    });
  }
};