const xlsx = require('xlsx');

const ItemCategoryModel = require('../../models/tenant/ItemCategory');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const StockTransactionModel = require('../../models/tenant/StockTransaction');

// ==================== ITEM CATEGORY CONTROLLERS ====================

exports.getCategories = async (req, res) => {
  try {
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const categories = await ItemCategory.find({ isActive: true })
      .populate('parentCategory')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const existing = await ItemCategory.findOne({
      $or: [{ code: req.body.code }, { name: req.body.name }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category name or code already exists',
      });
    }

    const category = await ItemCategory.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const category = await ItemCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const ItemCategory = ItemCategoryModel(req.tenantDb);
    const ItemMaster = ItemMasterModel(req.tenantDb);

    const itemsWithCategory = await ItemMaster.findOne({
      category: req.params.id,
    });

    if (itemsWithCategory) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing items',
      });
    }

    const category = await ItemCategory.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      message: 'Category deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ITEM MASTER CONTROLLERS ====================

exports.getItems = async (req, res) => {
  try {
    ItemCategoryModel(req.tenantDb);

    const ItemMaster = ItemMasterModel(req.tenantDb);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;

    const search = String(req.query.search || '').trim();

    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const allowedSortFields = [
      'name',
      'categoryName',
      'subCategoryName',
      'manufacturer',
      'currentStock',
      'sellingPrice',
      'createdAt',
    ];

    const finalSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { itemId: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } },
        { subCategoryName: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      ItemMaster.find(filter)
        .populate('category')
        .populate('subCategory')
        .sort({ [finalSortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      ItemMaster.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getItemById = async (req, res) => {
  try {
    ItemCategoryModel(req.tenantDb);

    const ItemMaster = ItemMasterModel(req.tenantDb);

    const item = await ItemMaster.findById(req.params.id).populate('category');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createItem = async (req, res) => {
  try {
    const ItemMaster = ItemMasterModel(req.tenantDb);

    const item = await ItemMaster.create(req.body);

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const ItemMaster = ItemMasterModel(req.tenantDb);

    const item = await ItemMaster.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const ItemMaster = ItemMasterModel(req.tenantDb);

    const item = await ItemMaster.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      message: 'Item deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getCategories = async (req, res) => {
  try {
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const categories = await ItemCategory.find({ isActive: true })
      .populate('parentCategory', 'name code')
      .sort({ parentCategory: 1, name: 1 });

    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createItem = async (req, res) => {
  try {
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const category = await ItemCategory.findById(req.body.category);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }

    let subCategory = null;
    if (req.body.subCategory) {
      subCategory = await ItemCategory.findById(req.body.subCategory);
      if (!subCategory) {
        return res.status(400).json({
          success: false,
          message: 'Sub category not found'
        });
      }
    }

    const count = await ItemMaster.countDocuments();

    const itemId = `ITEM-${String(count + 1).padStart(5, '0')}`;

    const item = await ItemMaster.create({
      ...req.body,
      itemId,
      categoryName: category.name,
      subCategoryName: subCategory?.name || ''
    });

    res.status(201).json({
      success: true,
      data: item
    });

  } catch (error) {
    console.error('Create item error:', error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    if (req.body.category) {
      const category = await ItemCategory.findById(req.body.category);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found' });
      }
      req.body.categoryName = category.name;
    }

    if (req.body.subCategory) {
      const subCategory = await ItemCategory.findById(req.body.subCategory);
      if (!subCategory) {
        return res.status(400).json({ success: false, message: 'Sub category not found' });
      }
      req.body.subCategoryName = subCategory.name;
    } else {
      req.body.subCategory = null;
      req.body.subCategoryName = '';
    }

    const item = await ItemMaster.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STOCK MANAGEMENT CONTROLLERS ====================

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;

    const { quantity, transactionType, notes, unitPrice } = req.body;

    const ItemMaster = ItemMasterModel(req.tenantDb);
    const StockTransaction = StockTransactionModel(req.tenantDb);

    const item = await ItemMaster.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    const qty = Number(quantity) || 0;

    if (qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }

    const previousStock = Number(item.currentStock) || 0;

    let newStock = previousStock;

    if (transactionType === 'purchase' || transactionType === 'return') {
      newStock = previousStock + qty;
    } else if (
      transactionType === 'sale' ||
      transactionType === 'damage' ||
      transactionType === 'expiry'
    ) {
      newStock = previousStock - qty;

      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock',
        });
      }
    } else if (transactionType === 'adjustment') {
      newStock = qty;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type',
      });
    }

    item.currentStock = newStock;

    await item.save();

    const transactionCount = await StockTransaction.countDocuments();

    const price = Number(unitPrice) || Number(item.sellingPrice) || 0;

    const transaction = await StockTransaction.create({
      transactionId: `TXN-${String(transactionCount + 1).padStart(6, '0')}`,
      itemId: item._id,
      itemName: item.name,
      itemCode: item.itemId,
      transactionType,
      quantity: qty,
      previousStock,
      newStock,
      unitPrice: price,
      totalAmount: price * qty,
      notes: String(notes || '').trim(),
      performedBy: req.user?.name || req.user?.email || 'System',
    });

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        item,
        transaction,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// inventoryController.js - Updated getStockTransactions function

exports.getStockTransactions = async (req, res) => {
  try {
    const StockTransaction = StockTransactionModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      transactionType,
      referenceType,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } },
        { transactionType: { $regex: `^${search}$`, $options: 'i' } },
        { performedBy: { $regex: search, $options: 'i' } },
        { referenceId: { $regex: search, $options: 'i' } },
        { referenceType: { $regex: search, $options: 'i' } },
      ];
    }

    // Transaction type filter
    if (transactionType) {
      filter.transactionType = transactionType;
    }

    // Reference type filter
    if (referenceType) {
      filter.referenceType = referenceType;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
        filter.createdAt.$gte.setHours(0, 0, 0, 0);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
        filter.createdAt.$lte.setHours(23, 59, 59, 999);
      }
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [transactions, total] = await Promise.all([
      StockTransaction.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      StockTransaction.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: transactions,
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
      message: error.message,
    });
  }
};

exports.getLowStockItems = async (req, res) => {
  try {
    ItemCategoryModel(req.tenantDb);

    const ItemMaster = ItemMasterModel(req.tenantDb);

    const items = await ItemMaster.find({
      $expr: {
        $lte: ['$currentStock', '$reorderLevel'],
      },
    }).populate('category');

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getExpiringItems = async (req, res) => {
  try {
    ItemCategoryModel(req.tenantDb);

    const ItemMaster = ItemMasterModel(req.tenantDb);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const items = await ItemMaster.find({
      'batches.expiryDate': {
        $lte: thirtyDaysFromNow,
        $gte: new Date(),
      },
    }).populate('category');

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== IMPORT/EXPORT CONTROLLERS ====================

exports.importItems = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const ItemMaster = ItemMasterModel(req.tenantDb);
    const ItemCategory = ItemCategoryModel(req.tenantDb);

    const workbook = xlsx.read(req.file.buffer, {
      type: 'buffer',
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
    });

    let createdCount = 0;
    let skippedCount = 0;

    const errors = [];

    const escapeRegex = (value = '') =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const row of rows) {
      try {
        const name = row['Item Name'] || row.name;
        const categoryName = row.Category || row.category;

        if (!name || !categoryName) {
          skippedCount++;
          continue;
        }

        const cleanCategoryName = String(categoryName).trim();

        const singularCategoryName = cleanCategoryName.endsWith('s')
          ? cleanCategoryName.slice(0, -1)
          : cleanCategoryName;

        const category = await ItemCategory.findOne({
          $or: [
            {
              name: {
                $regex: `^${escapeRegex(cleanCategoryName)}$`,
                $options: 'i',
              },
            },
            {
              name: {
                $regex: `^${escapeRegex(singularCategoryName)}$`,
                $options: 'i',
              },
            },
            {
              code: {
                $regex: `^${escapeRegex(cleanCategoryName)}$`,
                $options: 'i',
              },
            },
            {
              type: cleanCategoryName.toLowerCase(),
            },
            {
              type: singularCategoryName.toLowerCase(),
            },
          ],
        });

        if (!category) {
          errors.push(`Category not found: ${cleanCategoryName}`);
          skippedCount++;
          continue;
        }

        const itemIdFromExcel = String(row['Item ID'] || row.itemId || '').trim();

        const itemId =
          itemIdFromExcel || `ITM-${Date.now()}-${createdCount + 1}`;

        const existingItem = await ItemMaster.findOne({ itemId });

        if (existingItem) {
          errors.push(`Duplicate item ID skipped: ${itemId}`);
          skippedCount++;
          continue;
        }

        const item = new ItemMaster({
          itemId,
          name: String(name).trim(),
          genericName: String(row['Generic Name'] || '').trim(),
          category: category._id,
          categoryName: category.name,
          type: category.type,
          manufacturer: String(row.Manufacturer || '').trim(),
          brand: String(row.Brand || '').trim(),
          unit: String(row.Unit || 'piece').trim().toLowerCase(),
          unitSize: String(row['Unit Size'] || '').trim(),
          purchasePrice: parseFloat(row['Purchase Price']) || 0,
          sellingPrice: parseFloat(row['Selling Price']) || 0,
          mrp: parseFloat(row.MRP) || 0,
          tax: parseFloat(row.Tax) || 0,
          discount: parseFloat(row.Discount) || 0,
          currentStock: parseInt(row['Current Stock']) || 0,
          minimumStock: parseInt(row['Minimum Stock']) || 0,
          maximumStock: parseInt(row['Maximum Stock']) || 0,
          reorderLevel: parseInt(row['Reorder Level']) || 0,
          reorderQuantity: parseInt(row['Reorder Quantity']) || 0,
          storageLocation: String(row['Storage Location'] || '').trim(),
          rackNumber: String(row['Rack Number'] || '').trim(),
          batchManaged:
            String(row['Batch Managed'] || '').trim().toLowerCase() === 'yes',
          requiresPrescription:
            String(row['Requires Prescription'] || '')
              .trim()
              .toLowerCase() === 'yes',
          isControlled:
            String(row['Controlled Item'] || '').trim().toLowerCase() === 'yes',
          schedule: String(row.Schedule || '').trim(),
          description: String(row.Description || '').trim(),
          sideEffects: String(row['Side Effects'] || '').trim(),
          contraindications: String(row.Contraindications || '').trim(),
          storageInstructions: String(row['Storage Instructions'] || '').trim(),
          status: 'active',
          isActive: true,
        });

        await item.save();

        createdCount++;
      } catch (error) {
        skippedCount++;
        errors.push(error.message);
      }
    }

    res.json({
      success: true,
      data: {
        createdCount,
        skippedCount,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const sampleData = [
      {
        'Item ID': 'ITM-000001',
        'Item Name': 'Paracetamol 500mg',
        'Generic Name': 'Acetaminophen',
        Category: 'medicine',
        Manufacturer: 'Cipla',
        Brand: 'Paracip',
        Unit: 'strip',
        'Unit Size': '10 tablets',
        'Purchase Price': '25',
        'Selling Price': '35',
        MRP: '40',
        Tax: '12',
        Discount: '0',
        'Current Stock': '100',
        'Minimum Stock': '20',
        'Maximum Stock': '500',
        'Reorder Level': '30',
        'Reorder Quantity': '100',
        'Storage Location': 'A-1',
        'Rack Number': 'R-01',
        'Batch Managed': 'No',
        'Requires Prescription': 'No',
        'Controlled Item': 'No',
        Schedule: '',
        Description: 'Pain relief medication',
        'Side Effects': '',
        Contraindications: '',
        'Storage Instructions': 'Store in cool and dry place',
      },
    ];

    const ws = xlsx.utils.json_to_sheet(sampleData);
    const wb = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(wb, ws, 'Items Template');

    const buffer = xlsx.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=item-import-template.xlsx'
    );

    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};