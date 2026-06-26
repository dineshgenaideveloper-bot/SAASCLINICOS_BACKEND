// departmentController.js - Updated with pagination

const Department = require('../models/Department');

// GET ALL with pagination
exports.getDepartments = async (req, res) => {
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
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { specializationName: { $regex: search, $options: 'i' } },
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
    const [departments, total] = await Promise.all([
      Department.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Department.countDocuments(filter)
    ]);

    res.json({ 
      success: true, 
      data: departments,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch departments', 
      error: error.message 
    });
  }
};

// CREATE
exports.createDepartment = async (req, res) => {
  try {
    const department = await Department.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Department created successfully', 
      data: department 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department with this name, code, and specialization already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create department', 
      error: error.message 
    });
  }
};

// UPDATE
exports.updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }
    res.json({ 
      success: true, 
      message: 'Department updated successfully', 
      data: department 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department with this name, code, and specialization already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update department', 
      error: error.message 
    });
  }
};

// DELETE
exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }
    res.json({ 
      success: true, 
      message: 'Department deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete department', 
      error: error.message 
    });
  }
};

// STATUS TOGGLE
exports.updateDepartmentStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'isActive must be true or false' 
      });
    }
    const department = await Department.findByIdAndUpdate(
      req.params.id, 
      { isActive }, 
      { new: true, runValidators: true }
    );
    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }
    res.json({ 
      success: true, 
      message: `Department ${isActive ? 'activated' : 'deactivated'} successfully`, 
      data: department 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update department status', 
      error: error.message 
    });
  }
};

// IMPORT EXCEL (keep your existing import function)
const xlsx = require('xlsx');

exports.importDepartments = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let createdCount = 0;
    let skippedCount = 0;
    const skippedRows = [];

    // Map emoji to Font Awesome equivalents
    const emojiToFontAwesome = {
      '🌿': 'fa-leaf', '💊': 'fa-capsules', '👶': 'fa-baby', '🌸': 'fa-flower',
      '🔄': 'fa-sync', '🧠': 'fa-brain', '👴': 'fa-user', '✨': 'fa-sparkles',
      '🤧': 'fa-allergies', '🚑': 'fa-ambulance', '🩺': 'fa-stethoscope', '🩸': 'fa-tint',
      '❤️': 'fa-heart', '🌡️': 'fa-thermometer', '🦋': 'fa-butterfly', '🥗': 'fa-salad',
      '✈️': 'fa-plane', '🏭': 'fa-industry', '🛡️': 'fa-shield-alt', '🫀': 'fa-heart',
      '⚡': 'fa-bolt', '📡': 'fa-satellite-dish', '💔': 'fa-heart-broken', '🏃': 'fa-running',
      '🔬': 'fa-microscope', '☢️': 'fa-radiation', '📈': 'fa-chart-line', '🤸': 'fa-female',
      '🤕': 'fa-head-side-medical', '💪': 'fa-dumbbell', '🧩': 'fa-puzzle-piece', '👁️': 'fa-eye',
      '😴': 'fa-bed', '🦴': 'fa-bone', '🦵': 'fa-leg', '🔩': 'fa-cogs',
      '⚽': 'fa-futbol', '🤚': 'fa-hand-paper', '🦶': 'fa-foot', '🚨': 'fa-bell',
      '🔍': 'fa-search', '🍼': 'fa-baby-bottle', '🍽️': 'fa-utensils', '🫁': 'fa-lungs',
      '📏': 'fa-ruler', '🌈': 'fa-rainbow', '🎗️': 'fa-ribbon', '🫘': 'fa-seedling',
      '🧑': 'fa-user', '🤰': 'fa-pregnant-woman', '🔭': 'fa-telescope', '🔵': 'fa-circle',
      '✂️': 'fa-cut', '⭐': 'fa-star', '🔴': 'fa-circle', '🕶️': 'fa-sunglasses',
      '👂': 'fa-ear-listen', '👃': 'fa-nose', '🗣️': 'fa-comment', '🔪': 'fa-knife',
      '🦻': 'fa-ear-deaf', '💀': 'fa-skull', '🧴': 'fa-pump-soap', '💇': 'fa-cut',
      '💅': 'fa-nail', '☀️': 'fa-sun', '🩹': 'fa-band-aid', '⚖️': 'fa-balance-scale',
      '🏥': 'fa-hospital', '🛋️': 'fa-couch', '↕️': 'fa-arrows-alt-v', '👨': 'fa-mars',
      '👩': 'fa-venus', '🔧': 'fa-tools', '🤖': 'fa-robot', '🕊️': 'fa-dove',
      '🌬️': 'fa-wind', '🫧': 'fa-bubble', '🦠': 'fa-virus', '💓': 'fa-heartbeat',
      '💧': 'fa-tint', '🐕': 'fa-dog', '🐄': 'fa-cow', '🦷': 'fa-tooth',
      '🦜': 'fa-parrot', '🐾': 'fa-paw', '🐣': 'fa-chick', '🐟': 'fa-fish'
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        let name = row.name?.trim();
        let code = row.code?.trim().toUpperCase();
        let specializationName = row.specializationName?.trim();
        let description = row.description?.trim() || '';
        let icon = row.icon?.trim() || '';
        let isActive = row.isActive === 'Active';

        // Convert emoji to Font Awesome if emoji is found
        if (icon && emojiToFontAwesome[icon]) {
          icon = emojiToFontAwesome[icon];
        }

        // If no icon, assign default based on department code
        if (!icon) {
          const defaultIcons = {
            'HOMEO': 'fa-hospital', 'GM': 'fa-stethoscope', 'CARDIO': 'fa-heart',
            'NEURO': 'fa-brain', 'ORTHO': 'fa-bone', 'PEDS': 'fa-baby',
            'OBG': 'fa-female', 'OPHTH': 'fa-eye', 'ENT': 'fa-ear-listen',
            'DERM': 'fa-skin', 'PSYCH': 'fa-head-side-vr', 'GASTRO': 'fa-stomach',
            'URO': 'fa-kidneys', 'ONCO': 'fa-ribbon', 'PULMO': 'fa-lungs',
            'ENDO': 'fa-droplet', 'NEPHRO': 'fa-filters', 'RHEUM': 'fa-bone', 'VET': 'fa-dog'
          };
          icon = defaultIcons[code] || 'fa-hospital';
        }

        if (!name || !code || !specializationName) {
          skippedCount++;
          skippedRows.push({ row: i + 1, reason: 'Missing required fields' });
          continue;
        }

        // Check for duplicate
        const existing = await Department.findOne({
          name: name,
          code: code,
          specializationName: specializationName
        });

        if (existing) {
          skippedCount++;
          skippedRows.push({ row: i + 1, reason: 'Already exists' });
          continue;
        }

        await Department.create({
          name,
          code,
          specializationName,
          description,
          icon,
          isActive
        });

        createdCount++;
        
      } catch (error) {
        console.error(`Row ${i + 1}: Error -`, error.message);
        skippedCount++;
        skippedRows.push({ row: i + 1, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: `Imported ${createdCount} departments, skipped ${skippedCount}`,
      data: { createdCount, skippedCount, totalRows: rows.length, skippedRows }
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to import departments', 
      error: error.message 
    });
  }
};