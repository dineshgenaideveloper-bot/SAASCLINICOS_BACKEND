const mongoose = require('mongoose');

const {
  assertValidConfig,
  buildAttendanceQuery,
  buildLocationPayload,
  getConfigForRequest,
  getLocalDateKey,
  getMatchingStaffIds,
  getSafeAttendanceSort,
  getStaffDisplayName,
  getTenantModels,
  getUserName,
  resolveLoggedInStaff,
  resolveSaasScope,
  resolveStaffById,
  sendAttendanceError,
} = require('./staffAttendanceShared.js');

const getAttendanceConfig = async (req, res, next) => {
  try {
    const { StaffAttendanceConfig } = await getTenantModels(req);
    const scope = resolveSaasScope(req);

    let config = await StaffAttendanceConfig.findOne(scope).lean();

    if (!config && scope.tenantId !== 'default') {
      config = await StaffAttendanceConfig.findOne({
        tenantId: scope.tenantId,
        clinicId: 'default',
      }).lean();
    }

    res.json({
      success: true,
      data:
        config || {
          ...scope,
          clinicName: '',
          latitude: null,
          longitude: null,
          radiusMeters: 100,
          timeZone: 'Asia/Kolkata',
          isEnabled: true,
          requireLocation: true,
          allowCheckoutOutsideRadius: false,
        },
    });
  } catch (error) {
    next(error);
  }
};

const saveAttendanceConfig = async (req, res, next) => {
  try {
    const { StaffAttendanceConfig } = await getTenantModels(req);
    const scope = resolveSaasScope(req);

    const {
      clinicName,
      latitude,
      longitude,
      radiusMeters = 100,
      timeZone = 'Asia/Kolkata',
      isEnabled = true,
      requireLocation = true,
      allowCheckoutOutsideRadius = false,
    } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusMeters || 100);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Valid clinic latitude is required',
      });
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid clinic longitude is required',
      });
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid radius meters is required',
      });
    }

    const config = await StaffAttendanceConfig.findOneAndUpdate(
      scope,
      {
        $set: {
          ...scope,
          clinicName: clinicName || '',
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
          timeZone: timeZone || 'Asia/Kolkata',
          isEnabled: Boolean(isEnabled),
          requireLocation: Boolean(requireLocation),
          allowCheckoutOutsideRadius: Boolean(allowCheckoutOutsideRadius),
          updatedBy: req.user?._id,
          updatedByName: getUserName(req),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).lean();

    res.json({
      success: true,
      message: 'Staff attendance config saved',
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

const getAttendance = async (req, res, next) => {
  try {
    const { StaffAttendance, Staff } = await getTenantModels(req);

    const {
      page = 1,
      limit = 10,
      sortBy = 'attendanceDate',
      sortOrder = 'desc',
      from,
      to,
      staff,
      status,
      search,
    } = req.query;

    const query = buildAttendanceQuery(req);

    if (from || to) {
      query.attendanceDate = {};
      if (from) query.attendanceDate.$gte = String(from);
      if (to) query.attendanceDate.$lte = String(to);
    }

    if (staff && mongoose.Types.ObjectId.isValid(String(staff))) {
      query.staff = staff;
    }

    if (status) {
      query.status = String(status);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const staffIds = await getMatchingStaffIds(Staff, search);

      query.$or = [
        { attendanceDate: regex },
        { status: regex },
        { notes: regex },
        ...(staffIds.length ? [{ staff: { $in: staffIds } }] : []),
      ];
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const sort = getSafeAttendanceSort(sortBy, sortOrder);

    const [data, total] = await Promise.all([
      StaffAttendance.find(query)
        .populate(
          'staff',
          'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
        )
        .sort(sort)
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      StaffAttendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTodayAttendance = async (req, res, next) => {
  try {
    const { StaffAttendance } = await getTenantModels(req);
    const { staff } = req.query;

    const config = await getConfigForRequest(req);

    const attendanceDate = getLocalDateKey(
      new Date(),
      config?.timeZone || 'Asia/Kolkata'
    );

    const query = buildAttendanceQuery(req, {
      attendanceDate,
    });

    if (staff && mongoose.Types.ObjectId.isValid(String(staff))) {
      query.staff = staff;
    }

    const data = await StaffAttendance.find(query)
      .populate(
        'staff',
        'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const checkIn = async (req, res, next) => {
  try {
    const { StaffAttendance } = await getTenantModels(req);
    const { staff: staffId, latitude, longitude, accuracy, notes } = req.body;

    const scope = resolveSaasScope(req);
    const config = await getConfigForRequest(req);

    assertValidConfig(config);

    if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff is required',
      });
    }

    const staff = await resolveStaffById(req, staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    const attendanceDate = getLocalDateKey(
      new Date(),
      config.timeZone || 'Asia/Kolkata'
    );

    const existing = await StaffAttendance.findOne({
      ...scope,
      staff: staff._id,
      attendanceDate,
    });

    if (existing?.checkIn?.time) {
      return res.status(400).json({
        success: false,
        message: 'Staff already checked in today',
        data: existing,
      });
    }

    const checkInLocation = buildLocationPayload({
      latitude,
      longitude,
      accuracy,
      config,
    });

    const record = await StaffAttendance.findOneAndUpdate(
      {
        ...scope,
        staff: staff._id,
        attendanceDate,
      },
      {
        $setOnInsert: {
          ...scope,
          staff: staff._id,
          attendanceDate,
        },
        $set: {
          checkIn: checkInLocation,
          checkOut: undefined,
          workedMinutes: 0,
          status: 'checked_in',
          notes: notes || '',
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate(
      'staff',
      'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
    );

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: record,
    });
  } catch (error) {
    if (error.statusCode) {
      return sendAttendanceError(res, error);
    }

    next(error);
  }
};

const checkOut = async (req, res, next) => {
  try {
    const { StaffAttendance } = await getTenantModels(req);
    const { staff: staffId, latitude, longitude, accuracy, notes } = req.body;

    const scope = resolveSaasScope(req);
    const config = await getConfigForRequest(req);

    assertValidConfig(config);

    if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff is required',
      });
    }

    const staff = await resolveStaffById(req, staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    const attendanceDate = getLocalDateKey(
      new Date(),
      config.timeZone || 'Asia/Kolkata'
    );

    const record = await StaffAttendance.findOne({
      ...scope,
      staff: staff._id,
      attendanceDate,
    });

    if (!record?.checkIn?.time) {
      return res.status(400).json({
        success: false,
        message: 'Check-in not found for today',
      });
    }

    if (record?.checkOut?.time) {
      return res.status(400).json({
        success: false,
        message: 'Staff already checked out today',
        data: record,
      });
    }

    const checkOutLocation = buildLocationPayload({
      latitude,
      longitude,
      accuracy,
      config,
      allowOutsideRadius: Boolean(config.allowCheckoutOutsideRadius),
    });

    const workedMinutes = Math.max(
      Math.round(
        (checkOutLocation.time.getTime() -
          new Date(record.checkIn.time).getTime()) /
          60000
      ),
      0
    );

    record.checkOut = checkOutLocation;
    record.workedMinutes = workedMinutes;
    record.status = 'present';

    if (notes) {
      record.notes = record.notes
        ? `${record.notes}\nCheckout: ${notes}`
        : notes;
    }

    await record.save();

    await record.populate(
      'staff',
      'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
    );

    res.json({
      success: true,
      message: 'Check-out successful',
      data: record,
    });
  } catch (error) {
    if (error.statusCode) {
      return sendAttendanceError(res, error);
    }

    next(error);
  }
};

const getAttendanceSummary = async (req, res, next) => {
  try {
    const { StaffAttendance, Staff } = await getTenantModels(req);
    const { from, to, staff } = req.query;

    const match = buildAttendanceQuery(req);

    if (from || to) {
      match.attendanceDate = {};
      if (from) match.attendanceDate.$gte = String(from);
      if (to) match.attendanceDate.$lte = String(to);
    }

    if (staff && mongoose.Types.ObjectId.isValid(String(staff))) {
      match.staff = new mongoose.Types.ObjectId(String(staff));
    }

    const summary = await StaffAttendance.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: '$staff',
          presentDays: {
            $sum: {
              $cond: [
                {
                  $in: ['$status', ['checked_in', 'present']],
                },
                1,
                0,
              ],
            },
          },
          totalWorkedMinutes: {
            $sum: '$workedMinutes',
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const staffIds = summary.map((item) => item._id).filter(Boolean);

    const staffDocs = await Staff.find({
      _id: { $in: staffIds },
    })
      .select('name staffName fullName employeeName staffId employeeId phone email role departmentName')
      .lean();

    const staffMap = new Map(
      staffDocs.map((item) => [String(item._id), item])
    );

    const data = summary.map((item) => {
      const staffDoc = staffMap.get(String(item._id));

      return {
        staff: item._id,
        staffName: staffDoc ? getStaffDisplayName(staffDoc) : 'Unknown Staff',
        staffId: staffDoc?.staffId || staffDoc?.employeeId || '',
        presentDays: item.presentDays || 0,
        totalWorkedMinutes: item.totalWorkedMinutes || 0,
      };
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getMyAttendanceStatus = async (req, res, next) => {
  try {
    const { StaffAttendance } = await getTenantModels(req);

    const staff = await resolveLoggedInStaff(req);
    const config = await getConfigForRequest(req);

    const attendanceDate = getLocalDateKey(
      new Date(),
      config?.timeZone || 'Asia/Kolkata'
    );

    const record = await StaffAttendance.findOne({
      ...resolveSaasScope(req),
      staff: staff._id,
      attendanceDate,
    })
      .populate(
        'staff',
        'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
      )
      .lean();

    res.json({
      success: true,
      data: {
        staff,
        attendance: record,
        config,
      },
    });
  } catch (error) {
    next(error);
  }
};

const checkInMe = async (req, res, next) => {
  try {
    const staff = await resolveLoggedInStaff(req);

    req.body.staff = staff._id;

    return checkIn(req, res, next);
  } catch (error) {
    next(error);
  }
};

const checkOutMe = async (req, res, next) => {
  try {
    const staff = await resolveLoggedInStaff(req);

    req.body.staff = staff._id;

    return checkOut(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getMyAttendance = async (req, res, next) => {
  try {
    const { StaffAttendance } = await getTenantModels(req);

    const staff = await resolveLoggedInStaff(req);

    const {
      page = 1,
      limit = 10,
      sortBy = 'attendanceDate',
      sortOrder = 'desc',
      from,
      to,
      status,
      search,
    } = req.query;

    const query = buildAttendanceQuery(req, {
      staff: staff._id,
    });

    if (from || to) {
      query.attendanceDate = {};
      if (from) query.attendanceDate.$gte = String(from);
      if (to) query.attendanceDate.$lte = String(to);
    }

    if (status) {
      query.status = String(status);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');

      query.$or = [
        { attendanceDate: regex },
        { status: regex },
        { notes: regex },
      ];
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const sort = getSafeAttendanceSort(sortBy, sortOrder);

    const [data, total] = await Promise.all([
      StaffAttendance.find(query)
        .populate(
          'staff',
          'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName'
        )
        .sort(sort)
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      StaffAttendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceConfig,
  saveAttendanceConfig,
  getAttendance,
  getTodayAttendance,
  checkIn,
  checkOut,
  getAttendanceSummary,
  getMyAttendanceStatus,
  checkInMe,
  checkOutMe,
  getMyAttendance,
};
