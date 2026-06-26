import mongoose from 'mongoose';

import {
  getTenantModels,
  getUserName,
  resolveLoggedInStaff,
  resolveSaasScope,
} from './staffAttendanceShared.js';

function parseAttendanceTime(attendanceDate, timeValue) {
  if (!timeValue) return null;

  const value = String(timeValue).trim();

  if (!value) return null;

  if (value.includes('T')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(`${attendanceDate}T${value}:00+05:30`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateWorkedMinutes(checkInTime, checkOutTime) {
  if (!checkInTime || !checkOutTime) return 0;

  return Math.max(
    Math.round(
      (new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) /
        60000
    ),
    0
  );
}

function buildRegularizedLocation(time) {
  if (!time) return undefined;

  return {
    time,
    source: 'regularized',
  };
}

function getRegularizationPopulate() {
  return [
    {
      path: 'staff',
      select:
        'name staffName fullName employeeName staffId employeeId phone mobile email role departmentName',
    },
    {
      path: 'attendance',
    },
  ];
}

export const createMyAttendanceRegularization = async (req, res, next) => {
  try {
    const {
      StaffAttendance,
      StaffAttendanceRegularization,
    } = await getTenantModels(req);

    const staff = await resolveLoggedInStaff(req);

    const {
      attendance,
      attendanceDate,
      requestType = 'time_correction',
      checkInTime,
      checkOutTime,
      requestedStatus = 'present',
      reason,
      employeeNotes,
    } = req.body;

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: 'Attendance date is required',
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required',
      });
    }

    const scope = resolveSaasScope(req);

    let attendanceRecord = null;

    if (attendance && mongoose.Types.ObjectId.isValid(String(attendance))) {
      attendanceRecord = await StaffAttendance.findOne({
        ...scope,
        _id: attendance,
        staff: staff._id,
      }).lean();

      if (!attendanceRecord) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found for logged-in staff',
        });
      }
    } else {
      attendanceRecord = await StaffAttendance.findOne({
        ...scope,
        staff: staff._id,
        attendanceDate: String(attendanceDate),
      }).lean();
    }

    const pendingExists = await StaffAttendanceRegularization.findOne({
      ...scope,
      staff: staff._id,
      attendanceDate: String(attendanceDate),
      status: 'pending',
    }).lean();

    if (pendingExists) {
      return res.status(400).json({
        success: false,
        message: 'Regularization request already pending for this date',
      });
    }

    const requestedCheckInTime = parseAttendanceTime(attendanceDate, checkInTime);
    const requestedCheckOutTime = parseAttendanceTime(attendanceDate, checkOutTime);

    const regularization = await StaffAttendanceRegularization.create({
      ...scope,
      staff: staff._id,
      attendance: attendanceRecord?._id,
      attendanceDate: String(attendanceDate),
      requestType,
      requestedCheckInTime,
      requestedCheckOutTime,
      requestedStatus,
      reason: String(reason).trim(),
      employeeNotes: employeeNotes || '',
      source: 'my_attendance',
      requestedBy: req.user?._id,
      requestedByName: getUserName(req),
      status: 'pending',
    });

    await regularization.populate(getRegularizationPopulate());

    res.status(201).json({
      success: true,
      message: 'Attendance regularization request submitted',
      data: regularization,
    });
  } catch (error) {
    next(error);
  }
};

export const createStaffAttendanceRegularization = async (req, res, next) => {
  try {
    const {
      Staff,
      StaffAttendance,
      StaffAttendanceRegularization,
    } = await getTenantModels(req);

    const {
      staff,
      attendance,
      attendanceDate,
      requestType = 'time_correction',
      checkInTime,
      checkOutTime,
      requestedStatus = 'present',
      reason,
      adminNotes,
    } = req.body;

    const scope = resolveSaasScope(req);

    if (!staff || !mongoose.Types.ObjectId.isValid(String(staff))) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff is required',
      });
    }

    const staffDoc = await Staff.findById(staff).lean();

    if (!staffDoc) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: 'Attendance date is required',
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required',
      });
    }

    let attendanceRecord = null;

    if (attendance && mongoose.Types.ObjectId.isValid(String(attendance))) {
      attendanceRecord = await StaffAttendance.findOne({
        ...scope,
        _id: attendance,
        staff,
      }).lean();
    } else {
      attendanceRecord = await StaffAttendance.findOne({
        ...scope,
        staff,
        attendanceDate: String(attendanceDate),
      }).lean();
    }

    const requestedCheckInTime = parseAttendanceTime(attendanceDate, checkInTime);
    const requestedCheckOutTime = parseAttendanceTime(attendanceDate, checkOutTime);

    const regularization = await StaffAttendanceRegularization.create({
      ...scope,
      staff,
      attendance: attendanceRecord?._id,
      attendanceDate: String(attendanceDate),
      requestType,
      requestedCheckInTime,
      requestedCheckOutTime,
      requestedStatus,
      reason: String(reason).trim(),
      adminNotes: adminNotes || '',
      source: 'staff_attendance',
      requestedBy: req.user?._id,
      requestedByName: getUserName(req),
      status: 'pending',
    });

    await regularization.populate(getRegularizationPopulate());

    res.status(201).json({
      success: true,
      message: 'Staff attendance regularization created',
      data: regularization,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceRegularizations = async (req, res, next) => {
  try {
    const { StaffAttendanceRegularization } = await getTenantModels(req);

    const {
      page = 1,
      limit = 10,
      from,
      to,
      staff,
      status,
      source,
    } = req.query;

    const query = resolveSaasScope(req);

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

    if (source) {
      query.source = String(source);
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const [data, total] = await Promise.all([
      StaffAttendanceRegularization.find(query)
        .populate(getRegularizationPopulate())
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      StaffAttendanceRegularization.countDocuments(query),
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

export const getMyAttendanceRegularizations = async (req, res, next) => {
  try {
    const { StaffAttendanceRegularization } = await getTenantModels(req);

    const staff = await resolveLoggedInStaff(req);

    const {
      page = 1,
      limit = 10,
      status,
      from,
      to,
    } = req.query;

    const query = {
      ...resolveSaasScope(req),
      staff: staff._id,
    };

    if (status) {
      query.status = String(status);
    }

    if (from || to) {
      query.attendanceDate = {};
      if (from) query.attendanceDate.$gte = String(from);
      if (to) query.attendanceDate.$lte = String(to);
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const [data, total] = await Promise.all([
      StaffAttendanceRegularization.find(query)
        .populate(getRegularizationPopulate())
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      StaffAttendanceRegularization.countDocuments(query),
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

export const approveAttendanceRegularization = async (req, res, next) => {
  try {
    const {
      StaffAttendance,
      StaffAttendanceRegularization,
    } = await getTenantModels(req);

    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid regularization id is required',
      });
    }

    const scope = resolveSaasScope(req);

    const regularization = await StaffAttendanceRegularization.findOne({
      ...scope,
      _id: id,
    });

    if (!regularization) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found',
      });
    }

    if (regularization.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Regularization already ${regularization.status}`,
      });
    }

    const checkInLocation = buildRegularizedLocation(
      regularization.requestedCheckInTime
    );

    const checkOutLocation = buildRegularizedLocation(
      regularization.requestedCheckOutTime
    );

    const workedMinutes = calculateWorkedMinutes(
      regularization.requestedCheckInTime,
      regularization.requestedCheckOutTime
    );

    // NOTE: do NOT spread `scope` (tenantId), `staff`, or `attendanceDate`
    // into this object. Those fields are handled by the query filter and by
    // `$setOnInsert` below. Including them here would also place them in
    // `$set`, and MongoDB rejects the same path appearing in both `$set` and
    // `$setOnInsert` ("Updating the path 'tenantId' would create a conflict").
    const attendanceUpdate = {
      status: regularization.requestedStatus || 'present',
      isRegularized: true,
      regularizedAt: new Date(),
      regularizedBy: req.user?._id,
      regularizationRequest: regularization._id,
    };

    if (checkInLocation) {
      attendanceUpdate.checkIn = checkInLocation;
    }

    if (checkOutLocation) {
      attendanceUpdate.checkOut = checkOutLocation;
    }

    if (checkInLocation && checkOutLocation) {
      attendanceUpdate.workedMinutes = workedMinutes;
      attendanceUpdate.status = 'present';
    }

    if (regularization.reason) {
      attendanceUpdate.notes = `Regularized: ${regularization.reason}`;
    }

    const attendance = await StaffAttendance.findOneAndUpdate(
      {
        ...scope,
        staff: regularization.staff,
        attendanceDate: regularization.attendanceDate,
      },
      {
        $setOnInsert: {
          ...scope,
          staff: regularization.staff,
          attendanceDate: regularization.attendanceDate,
        },
        $set: attendanceUpdate,
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

    regularization.status = 'approved';
    regularization.adminNotes = adminNotes || regularization.adminNotes || '';
    regularization.reviewedBy = req.user?._id;
    regularization.reviewedByName = getUserName(req);
    regularization.reviewedAt = new Date();
    regularization.appliedAt = new Date();
    regularization.attendance = attendance._id;

    await regularization.save();

    await regularization.populate(getRegularizationPopulate());

    res.json({
      success: true,
      message: 'Regularization approved and attendance updated',
      data: {
        regularization,
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectAttendanceRegularization = async (req, res, next) => {
  try {
    const { StaffAttendanceRegularization } = await getTenantModels(req);

    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid regularization id is required',
      });
    }

    const regularization = await StaffAttendanceRegularization.findOne({
      ...resolveSaasScope(req),
      _id: id,
    });

    if (!regularization) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found',
      });
    }

    if (regularization.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Regularization already ${regularization.status}`,
      });
    }

    regularization.status = 'rejected';
    regularization.adminNotes = adminNotes || '';
    regularization.reviewedBy = req.user?._id;
    regularization.reviewedByName = getUserName(req);
    regularization.reviewedAt = new Date();

    await regularization.save();

    await regularization.populate(getRegularizationPopulate());

    res.json({
      success: true,
      message: 'Regularization rejected',
      data: regularization,
    });
  } catch (error) {
    next(error);
  }
};