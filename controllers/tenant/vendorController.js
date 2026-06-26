const xlsx = require('xlsx');
const VendorModel = require('../../models/tenant/Vendor');

exports.importVendors = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    const Vendor = VendorModel(req.tenantDb);

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
    });

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const name = row['Vendor Name'] || row.name;
        const phone = row.Phone || row.phone;

        if (!name || !phone) {
          skippedCount++;
          continue;
        }

        const existing = await Vendor.findOne({
          $or: [
            { name: String(name).trim() },
            { phone: String(phone).trim() },
            { gstin: String(row.GSTIN || '').trim().toUpperCase() },
          ],
        });

        if (existing) {
          skippedCount++;
          errors.push(`Duplicate vendor skipped: ${name}`);
          continue;
        }

        await Vendor.create({
          name: String(name).trim(),
          contactPerson: String(row['Contact Person'] || '').trim(),
          phone: String(phone).trim(),
          alternatePhone: String(row['Alternate Phone'] || '').trim(),
          email: String(row.Email || '').trim().toLowerCase(),
          gstin: String(row.GSTIN || '').trim().toUpperCase(),
          drugLicenseNumber: String(row['Drug License Number'] || '').trim(),
          panNumber: String(row['PAN Number'] || '').trim().toUpperCase(),
          address: String(row.Address || '').trim(),
          city: String(row.City || '').trim(),
          state: String(row.State || '').trim(),
          pincode: String(row.Pincode || '').trim(),
          paymentTerms: String(row['Payment Terms'] || 'Immediate').trim(),
          bankName: String(row['Bank Name'] || '').trim(),
          accountHolderName: String(row['Account Holder Name'] || '').trim(),
          accountNumber: String(row['Account Number'] || '').trim(),
          ifscCode: String(row['IFSC Code'] || '').trim().toUpperCase(),
          notes: String(row.Notes || '').trim(),
          status: 'active',
          isActive: true,
        });

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
      message: 'Failed to import vendors',
      error: error.message,
    });
  }
};

exports.downloadVendorTemplate = async (req, res) => {
  try {
    const sampleData = [
      {
        'Vendor Name': 'ABC Medical Suppliers',
        'Contact Person': 'Mr. Kumar',
        Phone: '9876543210',
        'Alternate Phone': '9876543211',
        Email: 'vendor@example.com',
        GSTIN: '33ABCDE1234F1Z5',
        'Drug License Number': 'DL-123456',
        'PAN Number': 'ABCDE1234F',
        Address: 'No 10, Medical Street',
        City: 'Chennai',
        State: 'Tamil Nadu',
        Pincode: '600001',
        'Payment Terms': '30 Days',
        'Bank Name': 'HDFC Bank',
        'Account Holder Name': 'ABC Medical Suppliers',
        'Account Number': '1234567890',
        'IFSC Code': 'HDFC0001234',
        Notes: 'Regular supplier',
      },
    ];

    const ws = xlsx.utils.json_to_sheet(sampleData);
    const wb = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(wb, ws, 'Vendors Template');

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
      'attachment; filename=vendor-import-template.xlsx'
    );

    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// vendorController.js - Updated getVendors function

exports.getVendors = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      city,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { vendorId: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // City filter
    if (city) {
      filter.city = { $regex: `^${city}$`, $options: 'i' };
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel
    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .populate('suppliedItems', 'name itemId categoryName subCategoryName unit currentStock')
        .lean(),
      Vendor.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: vendors,
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
      message: 'Failed to fetch vendors',
      error: error.message,
    });
  }
};
exports.getVendorById = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const vendor = await Vendor.findById(req.params.id).populate(
      'suppliedItems',
      'itemId name genericName categoryName unit'
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor',
      error: error.message,
    });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const vendor = await Vendor.create(req.body);

    const populatedVendor = await Vendor.findById(vendor._id).populate(
      'suppliedItems',
      'itemId name genericName categoryName unit'
    );

    res.status(201).json({
      success: true,
      data: populatedVendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create vendor',
      error: error.message,
    });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('suppliedItems', 'itemId name genericName categoryName unit');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor',
      error: error.message,
    });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const vendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete vendor',
      error: error.message,
    });
  }
};

exports.updateVendorStatus = async (req, res) => {
  try {
    const Vendor = VendorModel(req.tenantDb);

    const isActive = Boolean(req.body.isActive);

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        isActive,
        status: isActive ? 'active' : 'inactive',
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('suppliedItems', 'itemId name genericName categoryName unit');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor status',
      error: error.message,
    });
  }
};