// roleController.js - Updated with pagination

const xlsx = require('xlsx');
const Role = require('../models/Role');

// GET ALL with pagination
exports.getRoles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { roleName: { $regex: search, $options: 'i' } },
        { roleCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [roles, total] = await Promise.all([
      Role.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Role.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: roles,
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
      message: 'Failed to fetch roles',
      error: error.message,
    });
  }
};

// CREATE
exports.createRole = async (req, res) => {
  try {
    const { roleName, roleCode, description, isActive } = req.body;

    // Check for duplicate role code
    const existingRole = await Role.findOne({ roleCode: roleCode.toUpperCase() });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role code already exists',
      });
    }

    const role = await Role.create({
      roleName,
      roleCode: roleCode.toUpperCase(),
      description,
      isActive,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message,
    });
  }
};

// UPDATE
exports.updateRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message,
    });
  }
};

// UPDATE STATUS
exports.updateRoleStatus = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role status',
      error: error.message,
    });
  }
};

// DELETE
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Role deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message,
    });
  }
};

// IMPORT EXCEL
exports.importRoles = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = xlsx.utils.sheet_to_json(sheet, {
      range: 2,
      defval: '',
    });

    let createdCount = 0;
    let skippedCount = 0;
    const skippedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      
      try {
        const roleName = item['Role Name'];
        const roleCode = item['Role Code'];
        const description = item.Description || '';
        const department = item.Department || '';

        if (!roleName || !roleCode) {
          skippedCount++;
          skippedRows.push({ row: i + 3, reason: 'Missing required fields' });
          continue;
        }

        const exists = await Role.findOne({
          roleCode: String(roleCode).trim().toUpperCase(),
        });

        if (exists) {
          skippedCount++;
          skippedRows.push({ row: i + 3, reason: 'Role code already exists' });
          continue;
        }

        await Role.create({
          roleName: String(roleName).trim(),
          roleCode: String(roleCode).trim().toUpperCase(),
          description: String(description).trim(),
          department: String(department).trim(),
          isActive: true,
        });

        createdCount++;
      } catch (error) {
        skippedCount++;
        skippedRows.push({ row: i + 3, reason: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: { createdCount, skippedCount, totalRows: rows.length, skippedRows },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to import roles',
      error: error.message,
    });
  }
};