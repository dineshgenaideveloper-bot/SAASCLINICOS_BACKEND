// server/controllers/tenant/staffAttendanceShared.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { getTenantDB } = require('../../config/tenantDb.js');

const StaffAttendanceBase = require('../../models/tenant/StaffAttendance.js');
const StaffAttendanceConfigBase = require('../../models/tenant/StaffAttendanceConfig.js');
const StaffModelFactoryImport = require('../../models/tenant/Staff.js');
const StaffAttendanceRegularizationBase = require('../../models/tenant/StaffAttendanceRegularization.js');

function unwrapModule(mod) {
  return mod?.default || mod;
}

function createModel(connection, importedModelOrFactory, modelName) {
  const source = unwrapModule(importedModelOrFactory);

  if (!connection || !connection.models || typeof connection.model !== 'function') {
    throw new Error('Invalid tenant mongoose connection');
  }

  if (typeof source === 'function' && !source.schema) {
    return source(connection);
  }

  if (source?.schema) {
    return connection.models[modelName] || connection.model(modelName, source.schema);
  }

  throw new Error(`${modelName} model is not loaded correctly`);
}

function asIdString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

function getTokenUser(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return {};
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return {};
  }

  try {
    const secret =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      process.env.ACCESS_TOKEN_SECRET;

    if (secret) {
      return jwt.verify(token, secret) || {};
    }

    return jwt.decode(token) || {};
  } catch (error) {
    return jwt.decode(token) || {};
  }
}

function getTenantIdFromReq(req) {
  const tokenUser = getTokenUser(req);
  const user = req.user || {};

  return (
    asIdString(req.headers?.['x-tenant-id']) ||
    asIdString(req.headers?.['X-Tenant-ID']) ||
    asIdString(req.tenantId) ||
    asIdString(user.tenantId) ||
    asIdString(tokenUser.tenantId) ||
    'default'
  );
}

function resolveSaasScope(req) {
  const tenantId = getTenantIdFromReq(req);

  return {
    tenantId,
    clinicId: tenantId,
  };
}

async function getTenantModels(req) {
  const tenantId = getTenantIdFromReq(req);

  if (!tenantId || tenantId === 'default') {
    throw new Error('Tenant ID missing for staff attendance');
  }

  const connection = await getTenantDB(tenantId);

  const Staff = createModel(connection, StaffModelFactoryImport, 'Staff');

  const StaffAttendance = createModel(
    connection,
    StaffAttendanceBase,
    'StaffAttendance'
  );

  const StaffAttendanceConfig = createModel(
    connection,
    StaffAttendanceConfigBase,
    'StaffAttendanceConfig'
  );

  const StaffAttendanceRegularization = createModel(
    connection,
    StaffAttendanceRegularizationBase,
    'StaffAttendanceRegularization'
  );

  return {
    tenantId,
    connection,
    Staff,
    StaffAttendance,
    StaffAttendanceConfig,
    StaffAttendanceRegularization,
  };
}

function getUserName(req) {
  const tokenUser = getTokenUser(req);

  return (
    req.user?.name ||
    req.user?.fullName ||
    req.user?.email ||
    req.user?.phone ||
    tokenUser?.name ||
    tokenUser?.email ||
    ''
  );
}

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getLocalDateKey(date = new Date(), timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function assertValidConfig(config) {
  if (!config) {
    const error = new Error(
      'Staff attendance location config is not saved for this clinic'
    );
    error.statusCode = 400;
    throw error;
  }

  if (!config.isEnabled) {
    const error = new Error('Staff attendance is disabled for this clinic');
    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isFinite(Number(config.latitude)) ||
    !Number.isFinite(Number(config.longitude))
  ) {
    const error = new Error('Clinic latitude/longitude is not configured');
    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isFinite(Number(config.radiusMeters)) ||
    Number(config.radiusMeters) <= 0
  ) {
    const error = new Error('Attendance radius is not configured correctly');
    error.statusCode = 400;
    throw error;
  }
}

async function getConfigForRequest(req) {
  const { StaffAttendanceConfig } = await getTenantModels(req);
  const scope = resolveSaasScope(req);

  let config = await StaffAttendanceConfig.findOne(scope).lean();

  if (!config && scope.tenantId !== 'default') {
    config = await StaffAttendanceConfig.findOne({
      tenantId: scope.tenantId,
      clinicId: 'default',
    }).lean();
  }

  return config;
}

function buildLocationPayload({
  latitude,
  longitude,
  accuracy,
  config,
  allowOutsideRadius = false,
}) {
  assertValidConfig(config);

  const staffLat = Number(latitude);
  const staffLng = Number(longitude);

  const gpsAccuracy =
    accuracy === undefined || accuracy === null || accuracy === ''
      ? 0
      : Number(accuracy);

  const clinicLat = Number(config.latitude);
  const clinicLng = Number(config.longitude);
  const radiusMeters = Number(config.radiusMeters || 100);

  if (!Number.isFinite(staffLat) || staffLat < -90 || staffLat > 90) {
    const error = new Error('Valid latitude is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(staffLng) || staffLng < -180 || staffLng > 180) {
    const error = new Error('Valid longitude is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(gpsAccuracy) || gpsAccuracy < 0) {
    const error = new Error('Valid GPS accuracy is required');
    error.statusCode = 400;
    throw error;
  }

  const distanceMeters = getDistanceInMeters(
    clinicLat,
    clinicLng,
    staffLat,
    staffLng
  );

  const insideRadius = distanceMeters <= radiusMeters;

  if (!insideRadius && !allowOutsideRadius) {
    const error = new Error(
      `You are not inside clinic location. Distance: ${Math.round(
        distanceMeters
      )}m. Allowed radius: ${radiusMeters}m.`
    );

    error.statusCode = 400;
    error.distanceMeters = distanceMeters;
    error.radiusMeters = radiusMeters;

    throw error;
  }

  return {
    time: new Date(),
    latitude: staffLat,
    longitude: staffLng,
    distanceMeters: Number(distanceMeters.toFixed(2)),
    insideRadius,
  };
}

function getStaffDisplayName(staff) {
  return (
    staff.name ||
    staff.staffName ||
    staff.fullName ||
    staff.employeeName ||
    'Unnamed Staff'
  );
}

function buildAttendanceQuery(req, extra = {}) {
  return {
    ...resolveSaasScope(req),
    ...extra,
  };
}

async function resolveStaffById(req, staffId) {
  const { Staff } = await getTenantModels(req);

  if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
    return null;
  }

  return Staff.findById(staffId).lean();
}

async function resolveLoggedInStaff(req) {
  const { Staff } = await getTenantModels(req);
  const tokenUser = getTokenUser(req);

  const user = {
    ...(tokenUser || {}),
    ...(req.user || {}),
  };

  const possibleStaffId =
    asIdString(user.staff) ||
    asIdString(user.staff?._id) ||
    asIdString(user.staffId) ||
    asIdString(user.staffId?._id) ||
    asIdString(user.linkedStaff) ||
    asIdString(user.linkedStaffId) ||
    asIdString(user.employee) ||
    asIdString(user.employeeId) ||
    asIdString(user._id) ||
    asIdString(user.id) ||
    asIdString(user.userId) ||
    asIdString(user.sub);

  if (possibleStaffId && mongoose.Types.ObjectId.isValid(possibleStaffId)) {
    const staff = await Staff.findById(possibleStaffId).lean();

    if (staff) {
      return staff;
    }
  }

  const or = [];

  if (user.email) {
    or.push({ email: user.email });
    or.push({ workEmail: user.email });
    or.push({ personalEmail: user.email });
    or.push({ loginEmail: user.email });
  }

  if (user.phone) {
    or.push({ phone: user.phone });
    or.push({ mobile: user.phone });
    or.push({ contactNumber: user.phone });
  }

  if (user.mobile) {
    or.push({ phone: user.mobile });
    or.push({ mobile: user.mobile });
    or.push({ contactNumber: user.mobile });
  }

  if (user.staffCode) {
    or.push({ staffId: user.staffCode });
    or.push({ employeeId: user.staffCode });
  }

  if (user.employeeId) {
    or.push({ staffId: user.employeeId });
    or.push({ employeeId: user.employeeId });
  }

  if (user.username) {
    or.push({ staffId: user.username });
    or.push({ employeeId: user.username });
    or.push({ email: user.username });
    or.push({ phone: user.username });
  }

  if (or.length) {
    const staff = await Staff.findOne({ $or: or }).lean();

    if (staff) {
      return staff;
    }
  }

  const error = new Error('Logged-in user is not linked with staff');
  error.statusCode = 400;
  throw error;
}

async function getMatchingStaffIds(Staff, search) {
  const q = String(search || '').trim();

  if (!q) {
    return [];
  }

  const regex = new RegExp(q, 'i');

  const matchingStaff = await Staff.find({
    $or: [
      { name: regex },
      { staffName: regex },
      { fullName: regex },
      { employeeName: regex },
      { staffId: regex },
      { employeeId: regex },
      { phone: regex },
      { mobile: regex },
      { contactNumber: regex },
      { email: regex },
      { workEmail: regex },
      { personalEmail: regex },
      { loginEmail: regex },
    ],
  })
    .select('_id')
    .lean();

  return matchingStaff.map((staff) => staff._id);
}

function getSafeAttendanceSort(sortBy, sortOrder) {
  const allowedSortFields = [
    'attendanceDate',
    'createdAt',
    'updatedAt',
    'status',
    'workedMinutes',
    'checkIn.time',
    'checkOut.time',
  ];

  const safeSortBy = allowedSortFields.includes(String(sortBy))
    ? String(sortBy)
    : 'attendanceDate';

  return {
    [safeSortBy]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1,
  };
}

function sendAttendanceError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    message: error.message,
    distanceMeters: error.distanceMeters,
    radiusMeters: error.radiusMeters,
  });
}

module.exports = {
  createModel,
  asIdString,
  getTokenUser,
  getTenantIdFromReq,
  resolveSaasScope,
  getTenantModels,
  getUserName,
  getDistanceInMeters,
  getLocalDateKey,
  assertValidConfig,
  getConfigForRequest,
  buildLocationPayload,
  getStaffDisplayName,
  buildAttendanceQuery,
  resolveStaffById,
  resolveLoggedInStaff,
  getMatchingStaffIds,
  getSafeAttendanceSort,
  sendAttendanceError,
};