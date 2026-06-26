const MedicalBillModel = require('../../models/tenant/MedicalBill');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const StockTransactionModel = require('../../models/tenant/StockTransaction');
const { calculateGST } = require('../../utils/gstCalculator');

exports.createMedicalBill = async (req, res) => {
  try {
    const MedicalBill = MedicalBillModel(req.tenantDb);
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const StockTransaction = StockTransactionModel(req.tenantDb);

    const {
      patientName,
      patientPhone,
      items = [],
      paymentMode,
      notes,
      isInterState = false,
      placeOfSupply = '',
    } = req.body;

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: 'Bill items are required',
      });
    }

    let subTotal = 0;
    let discountAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let gstAmount = 0;

    const billItems = [];

    for (const row of items) {
      const item = await ItemMaster.findById(row.item);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item not found: ${row.item}`,
        });
      }

      const quantity = Number(row.quantity) || 0;

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${item.name}`,
        });
      }

      if (Number(item.currentStock) < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}`,
        });
      }

      const unitPrice = Number(row.unitPrice) || Number(item.sellingPrice) || 0;
      const discount = Number(row.discount) || 0;
      const gstRate = Number(row.gstRate ?? row.tax ?? item.tax) || 0;

      const gross = quantity * unitPrice;
      const discountValue = (gross * discount) / 100;
      const taxableAmount = gross - discountValue;

      const gst = calculateGST({
        amount: taxableAmount,
        gstRate,
        isInterState,
      });

      subTotal += gross;
      discountAmount += discountValue;
      cgstAmount += gst.cgstAmount;
      sgstAmount += gst.sgstAmount;
      igstAmount += gst.igstAmount;
      gstAmount += gst.gstAmount;

      billItems.push({
        item: item._id,
        itemName: item.name,
        itemCode: item.itemId,

        quantity,
        unitPrice,
        discount,

        gstRate: gst.gstRate,
        cgstRate: gst.cgstRate,
        sgstRate: gst.sgstRate,
        igstRate: gst.igstRate,

        taxableAmount: gst.taxableAmount,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount,
        gstAmount: gst.gstAmount,

        total: gst.totalAmount,
      });
    }

    const bill = new MedicalBill({
      patientName,
      patientPhone,
      items: billItems,

      subTotal,
      discountAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstAmount,
      taxAmount: gstAmount,
      grandTotal: subTotal - discountAmount + gstAmount,

      isInterState,
      placeOfSupply,

      paymentMode,
      status: paymentMode === 'credit' ? 'pending' : 'paid',
      notes,
      createdBy: req.user?.name || req.user?.email || 'System',
    });

    await bill.save();

    for (const row of bill.items) {
      const item = await ItemMaster.findById(row.item);

      const previousStock = Number(item.currentStock) || 0;
      const quantity = Number(row.quantity) || 0;
      const newStock = previousStock - quantity;

      item.currentStock = newStock;
      await item.save();

      const stockTransaction = new StockTransaction({
        itemId: item._id,
        itemName: item.name,
        itemCode: item.itemId,
        transactionType: 'sale',
        quantity,
        previousStock,
        newStock,
        unitPrice: row.unitPrice,
        totalAmount: row.total,
        referenceId: bill.billNumber,
        referenceType: 'MedicalBill',
        notes: `Stock reduced from bill ${bill.billNumber}`,
        performedBy: req.user?.name || req.user?.email || 'System',
      });

      await stockTransaction.save();
    }

    res.status(201).json({
      success: true,
      message: 'Medical bill created and stock reduced',
      data: bill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMedicalBills = async (req, res) => {
  try {
    ItemMasterModel(req.tenantDb);

    const MedicalBill = MedicalBillModel(req.tenantDb);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;

    const search = String(req.query.search || '').trim();

    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const allowedSortFields = [
      'billNumber',
      'patientName',
      'patientPhone',
      'grandTotal',
      'paymentMode',
      'status',
      'createdAt',
    ];

    const finalSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const filter = {};

    if (search) {
      filter.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { patientPhone: { $regex: search, $options: 'i' } },
        { paymentMode: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
      ];
    }

    const [bills, total] = await Promise.all([
      MedicalBill.find(filter)
        .populate('items.item', 'name itemId unit currentStock')
        .sort({ [finalSortBy]: sortOrder })
        .skip(skip)
        .limit(limit),

      MedicalBill.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: bills,
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