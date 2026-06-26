// server/controllers/tenant/staffPayslipController.js
const mongoose = require('mongoose');

const {
  getTenantModels,
  resolveLoggedInStaff,
  resolveSaasScope,
} = require('./staffAttendanceShared.js');

const Clinic = require('../../models/Clinic.js');

function parseMoney(value) {
  if (value === undefined || value === null) return 0;

  const cleaned = String(value)
    .replace(/[₹,\s]/g, '')
    .replace(/[^\d.-]/g, '');

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getStaffName(staff) {
  return staff?.name || 'Unnamed Staff';
}

function getMonthRange(month, year) {
  const now = new Date();

  const safeYear = Number(year) || now.getFullYear();
  const safeMonth = Number(month) || now.getMonth() + 1;

  const start = new Date(safeYear, safeMonth - 1, 1);
  const end = new Date(safeYear, safeMonth, 0);

  const yyyy = String(safeYear);
  const mm = String(safeMonth).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');

  return {
    month: safeMonth,
    year: safeYear,
    salaryMonth: `${yyyy}-${mm}`,
    from: `${yyyy}-${mm}-01`,
    to: `${yyyy}-${mm}-${dd}`,
    daysInMonth: end.getDate(),
  };
}

async function getClinicForPayslip(tenantId) {
  const clinic = await Clinic.findOne({ tenantId })
    .select(
      'name tenantId registrationNumber gstin type address contact settings.currency settings.timezone'
    )
    .lean();

  return {
    name: clinic?.name || '',
    tenantId,
    registrationNumber: clinic?.registrationNumber || '',
    gstin: clinic?.gstin || '',
    type: clinic?.type || '',
    address: clinic?.address || {},
    contact: clinic?.contact || {},
    currency: clinic?.settings?.currency || 'INR',
    timezone: clinic?.settings?.timezone || 'Asia/Kolkata',
  };
}

async function getAttendanceSummaryMap(req, staffIds, from, to) {
  const { StaffAttendance } = await getTenantModels(req);
  const scope = resolveSaasScope(req);

  const objectIds = staffIds
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (!objectIds.length) return new Map();

  const summary = await StaffAttendance.aggregate([
    {
      $match: {
        ...scope,
        staff: { $in: objectIds },
        attendanceDate: {
          $gte: from,
          $lte: to,
        },
      },
    },
    {
      $group: {
        _id: '$staff',

        presentDays: {
          $sum: {
            $cond: [{ $in: ['$status', ['checked_in', 'present']] }, 1, 0],
          },
        },

        absentDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0],
          },
        },

        rejectedDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0],
          },
        },

        totalWorkedMinutes: {
          $sum: '$workedMinutes',
        },
      },
    },
  ]);

  return new Map(summary.map((item) => [String(item._id), item]));
}

function buildPayslip({ staff, attendance, clinic, range, workingDays }) {
  const monthlyGrossSalary = parseMoney(staff.salary);

  const finalWorkingDays = Number(workingDays) || range.daysInMonth;

  const presentDays = Number(attendance?.presentDays || 0);
  const absentDays = Number(attendance?.absentDays || 0);
  const rejectedDays = Number(attendance?.rejectedDays || 0);
  const totalWorkedMinutes = Number(attendance?.totalWorkedMinutes || 0);

  const lossOfPayDays = absentDays + rejectedDays;

  const perDaySalary =
    finalWorkingDays > 0 ? monthlyGrossSalary / finalWorkingDays : 0;

  const lossOfPayAmount = roundMoney(perDaySalary * lossOfPayDays);

  const grossEarnings = roundMoney(monthlyGrossSalary);
  const totalDeductions = roundMoney(lossOfPayAmount);
  const netPay = roundMoney(grossEarnings - totalDeductions);

  return {
    tenantId: clinic.tenantId,
    clinicId: clinic.tenantId,

    clinic,

    salaryMonth: range.salaryMonth,

    period: {
      from: range.from,
      to: range.to,
      month: range.month,
      year: range.year,
      daysInMonth: range.daysInMonth,
      workingDays: finalWorkingDays,
    },

    staff: {
      _id: staff._id,
      staffId: staff.staffId || '',
      name: getStaffName(staff),
      email: staff.email || '',
      phone: staff.phone || '',
      alternatePhone: staff.alternatePhone || '',
      gender: staff.gender || '',
      dob: staff.dob || null,
      role: staff.role || '',
      departments: staff.departments || [],
      staffType: staff.staffType || '',
      joiningDate: staff.joiningDate || null,
      address: staff.address || '',
      status: staff.status || '',
    },

    identity: {
      aadhaarNumber: staff.aadhaarNumber || '',
      panNumber: staff.panNumber || '',
      esiNumber: staff.esiNumber || '',
      pfNumber: staff.pfNumber || '',
      uanNumber: staff.uanNumber || '',
    },

    bank: {
      bankName: staff.bankName || '',
      accountHolderName: staff.accountHolderName || '',
      accountNumber: staff.accountNumber || '',
      ifscCode: staff.ifscCode || '',
      branchName: staff.branchName || '',
    },

    attendance: {
      presentDays,
      absentDays,
      rejectedDays,
      lossOfPayDays,
      totalWorkedMinutes,
    },

    salary: {
      monthlyGrossSalary: grossEarnings,
      perDaySalary: roundMoney(perDaySalary),
    },

    earnings: {
      grossSalary: grossEarnings,
    },

    deductions: {
      lossOfPay: lossOfPayAmount,
    },

    grossEarnings,
    totalDeductions,
    netPay,
  };
}

const staffSelect = `
  staffId name email phone alternatePhone gender dob departments role
  degrees qualificationDetails staffType experiences
  aadhaarNumber panNumber esiNumber pfNumber uanNumber
  bankName accountHolderName accountNumber ifscCode branchName
  salary joiningDate address status
`;

async function buildPayslipsForStaff(req, staffDocs, range, workingDays) {
  const scope = resolveSaasScope(req);
  const clinic = await getClinicForPayslip(scope.tenantId);

  const attendanceMap = await getAttendanceSummaryMap(
    req,
    staffDocs.map((staff) => staff._id),
    range.from,
    range.to
  );

  return staffDocs.map((staff) =>
    buildPayslip({
      staff,
      attendance: attendanceMap.get(String(staff._id)),
      clinic,
      range,
      workingDays,
    })
  );
}

const getAllStaffPayslips = async (req, res, next) => {
  try {
    const { Staff } = await getTenantModels(req);

    const {
      page = 1,
      limit = 10,
      month,
      year,
      workingDays,
      search,
      status = 'active',
    } = req.query;

    const range = getMonthRange(month, year);

    const query = {};

    if (status) {
      query.status = String(status);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');

      query.$or = [
        { staffId: regex },
        { name: regex },
        { email: regex },
        { phone: regex },
        { role: regex },
        { departments: regex },
      ];
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const [staffDocs, total] = await Promise.all([
      Staff.find(query)
        .select(staffSelect)
        .sort({ name: 1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      Staff.countDocuments(query),
    ]);

    const data = await buildPayslipsForStaff(
      req,
      staffDocs,
      range,
      workingDays
    );

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

const getStaffPayslip = async (req, res, next) => {
  try {
    const { Staff } = await getTenantModels(req);
    const { staffId } = req.params;
    const { month, year, workingDays } = req.query;

    if (!mongoose.Types.ObjectId.isValid(String(staffId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff id is required',
      });
    }

    const staff = await Staff.findById(staffId).select(staffSelect).lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    const range = getMonthRange(month, year);

    const [payslip] = await buildPayslipsForStaff(
      req,
      [staff],
      range,
      workingDays
    );

    res.json({
      success: true,
      data: payslip,
    });
  } catch (error) {
    next(error);
  }
};

const getMyPayslip = async (req, res, next) => {
  try {
    const { Staff } = await getTenantModels(req);
    const { month, year, workingDays } = req.query;

    const loggedInStaff = await resolveLoggedInStaff(req);

    const staff = await Staff.findById(loggedInStaff._id)
      .select(staffSelect)
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    const range = getMonthRange(month, year);

    const [payslip] = await buildPayslipsForStaff(
      req,
      [staff],
      range,
      workingDays
    );

    res.json({
      success: true,
      data: payslip,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllStaffPayslips,
  getStaffPayslip,
  getMyPayslip,
};
