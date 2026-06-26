const xlsx = require('xlsx');
const AssetModel = require('../../models/tenant/Asset');
const AssetCategoryModel = require('../../models/tenant/AssetCategory');

// assetController.js - Updated getAssets function

exports.getAssets = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      condition,
      category,
      location,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { assetId: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Condition filter
    if (condition) {
      filter.condition = condition;
    }

    // Category filter
    if (category) {
      filter.category = { $regex: `^${category}$`, $options: 'i' };
    }

    // Location filter
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Asset.countDocuments(filter)
    ]);

    res.json({ 
      success: true, 
      data: assets,
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
      message: 'Failed to fetch assets',
      error: error.message,
    });
  }
};

exports.getAssetById = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch asset',
      error: error.message,
    });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);

    if (req.body.assetId) {
      const exists = await Asset.findOne({ assetId: req.body.assetId });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Asset ID already exists',
        });
      }
    }

    const asset = await Asset.create(req.body);

    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('createAsset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create asset',
      error: error.message,
    });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);

    if (req.body.assetId) {
      const existingAsset = await Asset.findOne({ 
        assetId: req.body.assetId,
        _id: { $ne: req.params.id }
      });
      
      if (existingAsset) {
        return res.status(400).json({
          success: false,
          message: 'Asset ID already exists in database',
        });
      }
    }

    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update asset',
      error: error.message,
    });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);
    await Asset.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete asset',
      error: error.message,
    });
  }
};

exports.addMaintenanceLog = async (req, res) => {
  try {
    const Asset = AssetModel(req.tenantDb);
    const { id } = req.params;
    const maintenanceLog = req.body;

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    asset.maintenanceLogs.push(maintenanceLog);
    asset.lastMaintenanceDate = maintenanceLog.date;
    
    if (maintenanceLog.nextDueDate) {
      asset.nextMaintenanceDate = maintenanceLog.nextDueDate;
    }

    await asset.save();
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add maintenance log',
      error: error.message,
    });
  }
};

// ============= CATEGORY MANAGEMENT WITH SUBCATEGORIES =============

exports.getAssetCategories = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const categories = await AssetCategory.find({ isActive: true })
      .populate('parentCategory')
      .sort({ name: 1 });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('getAssetCategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch asset categories',
      error: error.message,
    });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const category = await AssetCategory.findById(req.params.id)
      .populate('parentCategory');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message,
    });
  }
};

exports.createAssetCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    
    // Check if category with same code exists
    const existingCategory = await AssetCategory.findOne({ 
      $or: [
        { code: req.body.code },
        { name: req.body.name }
      ]
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with same name or code already exists',
      });
    }
    
    const category = await AssetCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('createAssetCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create asset category',
      error: error.message,
    });
  }
};

exports.updateAssetCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    
    const category = await AssetCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update asset category',
      error: error.message,
    });
  }
};

exports.deleteAssetCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    
    // Check if category has assets
    const Asset = AssetModel(req.tenantDb);
    const assetsWithCategory = await Asset.findOne({ categoryId: req.params.id });
    
    if (assetsWithCategory) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing assets',
      });
    }
    
    await AssetCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete asset category',
      error: error.message,
    });
  }
};

// ============= SUBCATEGORY MANAGEMENT =============

exports.addSubCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const { categoryId } = req.params;
    const subCategory = req.body;
    
    const category = await AssetCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check if subcategory with same name exists
    const existingSub = category.subCategories.find(
      sub => sub.name.toLowerCase() === subCategory.name.toLowerCase()
    );
    
    if (existingSub) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory with this name already exists',
      });
    }
    
    category.subCategories.push(subCategory);
    await category.save();
    
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add subcategory',
      error: error.message,
    });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const { categoryId, subCategoryId } = req.params;
    
    const category = await AssetCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subCategory = category.subCategories.id(subCategoryId);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    Object.assign(subCategory, req.body);
    await category.save();
    
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update subcategory',
      error: error.message,
    });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const { categoryId, subCategoryId } = req.params;
    
    const category = await AssetCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    category.subCategories.pull({ _id: subCategoryId });
    await category.save();
    
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete subcategory',
      error: error.message,
    });
  }
};

// ============= EXCEL IMPORT =============

exports.importAssets = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const Asset = AssetModel(req.tenantDb);
    const AssetCategory = AssetCategoryModel(req.tenantDb);

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    let createdCount = 0;
    let skippedCount = 0;
    let errors = [];

    // Get last asset ID
    const lastAsset = await Asset.findOne({}, {}, { sort: { createdAt: -1 } });
    let lastId = 0;
    if (lastAsset?.assetId) {
      const match = lastAsset.assetId.match(/AST-(\d+)/);
      if (match) lastId = parseInt(match[1]);
    }

    // Get all categories for mapping
    const categories = await AssetCategory.find({});
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name, cat);
      categoryMap.set(cat.code, cat);
    });

    for (const item of rows) {
      try {
        const name = item['Asset Name'] || item['name'] || item['Name'];
        const category = item['Category'] || item['category'];
        
        if (!name || !category) {
          skippedCount++;
          errors.push(`Skipped: Missing name or category for row ${rows.indexOf(item) + 2}`);
          continue;
        }

        lastId++;
        const assetId = `AST-${String(lastId).padStart(4, '0')}`;
        
        // Find category ID if exists
        const categoryData = categoryMap.get(category);
        
        // Parse tags from string
        let tags = [];
        const tagsStr = item['Tags'] || item['tags'];
        if (tagsStr) {
          tags = String(tagsStr).split(',').map(t => t.trim()).filter(Boolean);
        }

        const asset = new Asset({
          assetId,
          name: String(name).trim(),
          category: String(category).trim(),
          subCategory: String(item['Sub Category'] || item['subCategory'] || '').trim(),
          categoryId: categoryData?._id,
          model: String(item['Model'] || item['model'] || '').trim(),
          serialNumber: String(item['Serial Number'] || item['serialNumber'] || '').trim(),
          manufacturer: String(item['Manufacturer'] || item['manufacturer'] || '').trim(),
          supplier: String(item['Supplier'] || item['supplier'] || '').trim(),
          purchaseDate: item['Purchase Date'] || item['purchaseDate'] ? new Date(item['Purchase Date'] || item['purchaseDate']) : null,
          purchaseCost: String(item['Purchase Cost'] || item['purchaseCost'] || '').trim(),
          warrantyExpiryDate: item['Warranty Expiry'] || item['warrantyExpiry'] ? new Date(item['Warranty Expiry'] || item['warrantyExpiry']) : null,
          invoiceNumber: String(item['Invoice Number'] || item['invoiceNumber'] || '').trim(),
          location: String(item['Location'] || item['location'] || '').trim(),
          assignedTo: String(item['Assigned To'] || item['assignedTo'] || '').trim(),
          assignedType: ['staff', 'department', 'none'].includes(String(item['Assigned Type'] || '').toLowerCase()) 
            ? String(item['Assigned Type']).toLowerCase() 
            : 'none',
          status: ['active', 'maintenance', 'retired', 'disposed'].includes(String(item['Status'] || '').toLowerCase())
            ? String(item['Status']).toLowerCase()
            : 'active',
          condition: ['excellent', 'good', 'fair', 'poor', 'damaged'].includes(String(item['Condition'] || '').toLowerCase())
            ? String(item['Condition']).toLowerCase()
            : 'good',
          notes: String(item['Notes'] || item['notes'] || '').trim(),
          tags,
          insuranceProvider: String(item['Insurance Provider'] || item['insuranceProvider'] || '').trim(),
          insurancePolicyNumber: String(item['Insurance Policy'] || item['insurancePolicy'] || '').trim(),
          insuranceExpiryDate: item['Insurance Expiry'] || item['insuranceExpiry'] ? new Date(item['Insurance Expiry'] || item['insuranceExpiry']) : null,
          isActive: true
        });

        await asset.save();
        createdCount++;
      } catch (error) {
        skippedCount++;
        errors.push(`Error in row ${rows.indexOf(item) + 2}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      data: { 
        createdCount, 
        skippedCount,
        errors: errors.slice(0, 10) // Return first 10 errors
      },
    });
  } catch (error) {
    console.error('importAssets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import assets',
      error: error.message,
    });
  }
};

// Download sample Excel template
exports.downloadAssetTemplate = async (req, res) => {
  try {
    const AssetCategory = AssetCategoryModel(req.tenantDb);
    const categories = await AssetCategory.find({ isActive: true });
    
    // Create sample data
    const sampleData = [{
      'Asset Name': 'Example: X-Ray Machine',
      'Category': categories[0]?.name || 'Medical Equipment',
      'Sub Category': 'Diagnostic',
      'Model': 'XR-2000',
      'Serial Number': 'SN123456',
      'Manufacturer': 'Siemens',
      'Supplier': 'MedSupply Co.',
      'Purchase Date': '2024-01-15',
      'Purchase Cost': '50000',
      'Warranty Expiry': '2026-01-15',
      'Invoice Number': 'INV-001',
      'Location': 'Room 101, Ground Floor',
      'Assigned To': 'Dr. Smith',
      'Assigned Type': 'staff',
      'Status': 'active',
      'Condition': 'excellent',
      'Tags': 'X-Ray,Diagnostic,High-Value',
      'Notes': 'Annual maintenance required',
      'Insurance Provider': 'Insurance Co.',
      'Insurance Policy': 'POL-123',
      'Insurance Expiry': '2025-12-31'
    }];
    
    const ws = xlsx.utils.json_to_sheet(sampleData);
    
    // Add categories list as a separate sheet
    const categoryData = categories.map(cat => ({
      'Category Name': cat.name,
      'Category Code': cat.code,
      'Description': cat.description || '',
      'Sub Categories': cat.subCategories.map(sub => sub.name).join(', ')
    }));
    
    const wsCategories = xlsx.utils.json_to_sheet(categoryData);
    
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Assets Template');
    xlsx.utils.book_append_sheet(wb, wsCategories, 'Available Categories');
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=asset-import-template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message,
    });
  }
};