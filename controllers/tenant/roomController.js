const WardModel = require('../../models/tenant/Ward');
const RoomModel = require('../../models/tenant/Room');

exports.getRooms = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      ward,
      roomType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { roomId: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { floor: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (ward) filter.ward = ward;
    if (roomType) filter.roomType = roomType;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [rooms, total] = await Promise.all([
      Room.find(filter)
        .populate('ward', 'wardId name speciality wardType floor')
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Room.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: rooms,
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
      message: 'Failed to fetch rooms',
      error: error.message,
    });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);

    const room = await Room.findById(req.params.id).populate(
      'ward',
      'wardId name speciality wardType floor'
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room',
      error: error.message,
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);
    const Room = RoomModel(req.tenantDb);

    const ward = await Ward.findById(req.body.ward);

    if (!ward) {
      return res.status(400).json({
        success: false,
        message: 'Valid ward is required',
      });
    }

    const room = await Room.create(req.body);

    const populatedRoom = await Room.findById(room._id).populate(
      'ward',
      'wardId name speciality wardType floor'
    );

    res.status(201).json({
      success: true,
      data: populatedRoom,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
      error: error.message,
    });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const Ward = WardModel(req.tenantDb);
    const Room = RoomModel(req.tenantDb);

    if (req.body.ward) {
      const ward = await Ward.findById(req.body.ward);

      if (!ward) {
        return res.status(400).json({
          success: false,
          message: 'Valid ward is required',
        });
      }
    }

    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('ward', 'wardId name speciality wardType floor');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update room',
      error: error.message,
    });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);

    const room = await Room.findByIdAndDelete(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      message: 'Room deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete room',
      error: error.message,
    });
  }
};

exports.updateRoomStatus = async (req, res) => {
  try {
    const Room = RoomModel(req.tenantDb);

    const isActive = Boolean(req.body.isActive);

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      {
        isActive,
        status: isActive ? 'active' : 'inactive',
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('ward', 'wardId name speciality wardType floor');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update room status',
      error: error.message,
    });
  }
};