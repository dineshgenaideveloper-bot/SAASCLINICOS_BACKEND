const xlsx = require('xlsx');
const StaffModel = require('../../models/tenant/Staff');


exports.getStaff = async (req, res) => {
  try {
    const Staff = StaffModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      department,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter (name, email, phone, staffId)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { staffId: { $regex: search, $options: 'i' } },
      ];
    }

    // Department filter
    if (department) {
      filter.departments = department;
    }

    // Role filter
    if (role) {
      filter.role = role;
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [staff, total] = await Promise.all([
      Staff.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Staff.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: staff,
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
      message: 'Failed to fetch staff',
      error: error.message,
    });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const Staff = StaffModel(req.tenantDb);

    if (req.body.staffId) {
      const exists = await Staff.findOne({ staffId: req.body.staffId });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID already exists',
        });
      }
    }

    const payload = {
      ...req.body,
      departments: Array.isArray(req.body.departments)
        ? req.body.departments
        : req.body.department
          ? [req.body.department]
          : [],
    };

    delete payload.department;

    if (!payload.name || !payload.departments.length || !payload.role) {
      return res.status(400).json({
        success: false,
        message: 'Name, departments and role are required',
      });
    }

    const staff = await Staff.create(payload);

    res.status(201).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create staff',
      error: error.message,
    });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const Staff = StaffModel(req.tenantDb);

    if (req.body.staffId) {
      const existingStaff = await Staff.findOne({
        staffId: req.body.staffId,
        _id: { $ne: req.params.id },
      });

      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID already exists in database',
        });
      }
    }

    const payload = {
      ...req.body,
      departments: Array.isArray(req.body.departments)
        ? req.body.departments
        : req.body.department
          ? [req.body.department]
          : [],
    };

    delete payload.department;

    const staff = await Staff.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update staff',
      error: error.message,
    });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const Staff = StaffModel(req.tenantDb);

    await Staff.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Staff deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff',
      error: error.message,
    });
  }
};

exports.importStaff = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const Staff = StaffModel(req.tenantDb);

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    let createdCount = 0;
    let skippedCount = 0;

    const lastStaff = await Staff.findOne({}, {}, { sort: { createdAt: -1 } });

    let lastId = 0;

    if (lastStaff?.staffId) {
      const match = lastStaff.staffId.match(/STF-(\d+)/);
      if (match) lastId = Number(match[1]) || 0;
    }

    for (const item of rows) {
      const name = item['Name'] || item.name;
      const departmentsRaw =
        item['Departments'] ||
        item['Department'] ||
        item.departments ||
        item.department;

      const departments = String(departmentsRaw || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

      const role = item['Role'] || item.role;

      if (!name || !departments.length || !role) {
        skippedCount++;
        continue;
      }

      lastId++;

      const staffId = `STF-${String(lastId).padStart(4, '0')}`;

      const staff = new Staff({
        staffId,
        name: String(name).trim(),
        email: String(item['Email'] || '').trim(),
        phone: String(item['Phone'] || '').trim(),
        alternatePhone: String(item['Alternate Phone'] || '').trim(),
        gender: String(item['Gender'] || '').trim(),

        departments,
        role: String(role).trim(),

        degrees: String(item['Degrees'] || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),

        qualificationDetails: String(item['Qualification Details'] || '').trim(),

        staffType: ['Fresher', 'Experienced'].includes(
          String(item['Staff Type']).trim()
        )
          ? String(item['Staff Type']).trim()
          : 'Fresher',

        experiences: [],

        aadhaarNumber: String(item['Aadhaar Number'] || '').trim(),
        panNumber: String(item['PAN Number'] || '').trim(),
        esiNumber: String(item['ESI Number'] || '').trim(),
        pfNumber: String(item['PF Number'] || '').trim(),
        uanNumber: String(item['UAN Number'] || '').trim(),

        bankName: String(item['Bank Name'] || '').trim(),
        accountHolderName: String(item['Account Holder Name'] || '').trim(),
        accountNumber: String(item['Account Number'] || '').trim(),
        ifscCode: String(item['IFSC Code'] || '').trim(),
        branchName: String(item['Branch Name'] || '').trim(),

        salary: String(item['Salary'] || '').trim(),
        address: String(item['Address'] || '').trim(),
        status: 'active',
      });

      await staff.save();
      createdCount++;
    }

    res.json({
      success: true,
      data: {
        createdCount,
        skippedCount,
      },
    });
  } catch (error) {
    console.error('importStaff error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to import staff',
      error: error.message,
    });
  }
};