const PurchaseOrderModel = require('../../models/tenant/PurchaseOrder');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const StockTransactionModel = require('../../models/tenant/StockTransaction');
const VendorModel = require('../../models/tenant/Vendor');
const { calculateGST } = require('../../utils/gstCalculator');

const getLoggedUserName = (req, bodyName = '') => {
  return (
    bodyName ||
    req.user?.name ||
    req.user?.email ||
    'System'
  );
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const Vendor = VendorModel(req.tenantDb);

    const {
      vendor,
      items = [],
      notes,
      isInterState = false,
      placeOfSupply = '',
      deliveryAddress = '',
      createdBy = '',
    } = req.body;

    if (!vendor || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Vendor and items are required',
      });
    }

    const vendorDoc = await Vendor.findById(vendor);

    if (!vendorDoc) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    let subTotal = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let gstAmount = 0;

    const poItems = [];

    for (const row of items) {
      const item = await ItemMaster.findById(row.item);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item not found: ${row.item}`,
        });
      }

      const quantity = Number(row.quantity) || 0;
      const purchasePrice = Number(row.purchasePrice) || 0;
      const sellingPrice =
        Number(row.sellingPrice) ||
        Number(item.sellingPrice) ||
        0;

      const mrp =
        Number(row.mrp) ||
        Number(item.mrp) ||
        0;

      const gstRate =
        Number(row.gstRate ?? row.tax ?? item.tax) ||
        0;

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${item.name}`,
        });
      }

      const taxableAmount = quantity * purchasePrice;

      const gst = calculateGST({
        amount: taxableAmount,
        gstRate,
        isInterState,
      });

      subTotal += gst.taxableAmount;
      cgstAmount += gst.cgstAmount;
      sgstAmount += gst.sgstAmount;
      igstAmount += gst.igstAmount;
      gstAmount += gst.gstAmount;

      poItems.push({
        item: item._id,
        itemName: item.name,
        itemCode: item.itemId,

        batchNumber: row.batchNumber || '',
        expiryDate: row.expiryDate || null,

        quantity,
        purchasePrice,
        sellingPrice,
        mrp,

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

    const purchaseOrder = new PurchaseOrder({
      vendor,
      vendorName: vendorDoc.name,
      items: poItems,

      subTotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstAmount,
      taxAmount: gstAmount,
      grandTotal: subTotal + gstAmount,

      isInterState,
      placeOfSupply,
      deliveryAddress,

      status: 'draft',
      notes,
      createdBy: getLoggedUserName(req, createdBy),
    });

    await purchaseOrder.save();

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: purchaseOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/tenant/purchaseOrderController.js - add this function

exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);

    const po = await PurchaseOrder.findById(req.params.id);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    if (po.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'Received purchase order cannot be cancelled',
      });
    }

    po.status = 'cancelled';
    await po.save();

    res.json({
      success: true,
      message: 'Purchase order cancelled',
      data: po,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.receivePurchaseOrder = async (req, res) => {
  try {
    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const StockTransaction = StockTransactionModel(req.tenantDb);

    const {
      deliveryInvoiceNo,
      deliveryAddress,
      receivedBy = '',
    } = req.body;

    const receiverName = getLoggedUserName(req, receivedBy);

    if (!deliveryInvoiceNo) {
      return res.status(400).json({
        success: false,
        message: 'Delivery invoice number is required to receive stock',
      });
    }

    const po = await PurchaseOrder.findById(req.params.id);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    if (po.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order already received',
      });
    }

    if (po.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled purchase order cannot be received',
      });
    }

    for (const row of po.items) {
      const item = await ItemMaster.findById(row.item);
      if (!item) continue;

      const previousStock = Number(item.currentStock) || 0;
      const quantity = Number(row.quantity) || 0;
      const newStock = previousStock + quantity;

      item.currentStock = newStock;
      item.purchasePrice = Number(row.purchasePrice) || 0;
      item.sellingPrice = Number(row.sellingPrice) || 0;
      item.mrp = Number(row.mrp) || 0;
      item.tax = Number(row.gstRate) || 0;

      if (item.batchManaged && row.batchNumber) {
        item.batches.push({
          batchNumber: row.batchNumber,
          manufacturer: item.manufacturer,
          expiryDate: row.expiryDate,
          purchasePrice: row.purchasePrice,
          sellingPrice: row.sellingPrice,
          mrp: row.mrp,
          quantity,
          rackNumber: item.rackNumber,
        });
      }

      await item.save();

      await StockTransaction.create({
        itemId: item._id,
        itemName: item.name,
        itemCode: item.itemId,
        batchNumber: row.batchNumber || '',
        transactionType: 'purchase',
        quantity,
        previousStock,
        newStock,
        unitPrice: row.purchasePrice,
        totalAmount: quantity * Number(row.purchasePrice || 0),
        referenceId: po.poNumber,
        referenceType: 'PurchaseOrder',
        notes: `Stock added from PO ${po.poNumber}. Delivery Invoice: ${deliveryInvoiceNo}`,
        performedBy: receiverName,
      });
    }

    po.status = 'received';
    po.deliveryInvoiceNo = deliveryInvoiceNo;
    po.deliveryAddress = deliveryAddress || po.deliveryAddress;
    po.receivedAt = new Date();
    po.receivedBy = receiverName;

    await po.save();

    res.json({
      success: true,
      message: 'Purchase order received and stock updated',
      data: po,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/tenant/purchaseOrderController.js (updated exports.getPurchaseOrders)

exports.getPurchaseOrders = async (req, res) => {
  try {
    VendorModel(req.tenantDb);
    ItemMasterModel(req.tenantDb);

    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Search parameter
    const search = req.query.search || '';
    
    // Filter by status
    const status = req.query.status || '';
    
    // Sort parameters
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    // Build query
    let query = {};
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search functionality (search by PO number or vendor name)
    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute queries in parallel
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('vendor', 'name phone email gstin address city state pincode')
        .populate('items.item', 'name itemId unit currentStock')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getPurchaseOrderById = async (req, res) => {
  try {
    VendorModel(req.tenantDb);
    ItemMasterModel(req.tenantDb);

    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);

    const order = await PurchaseOrder.findById(req.params.id)
      .populate(
        'vendor',
        'name phone email gstin address city state pincode'
      )
      .populate(
        'items.item',
        'name itemId unit currentStock'
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const PurchaseOrder = PurchaseOrderModel(req.tenantDb);

    const po = await PurchaseOrder.findById(req.params.id);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    if (po.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'Received purchase order cannot be cancelled',
      });
    }

    po.status = 'cancelled';
    await po.save();

    res.json({
      success: true,
      message: 'Purchase order cancelled',
      data: po,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};