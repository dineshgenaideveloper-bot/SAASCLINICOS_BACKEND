const PatientModel = require('../../models/tenant/Patient');
const MedicalBillModel = require('../../models/tenant/MedicalBill');
const ItemCategoryModel = require('../../models/tenant/ItemCategory');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const StockTransactionModel = require('../../models/tenant/StockTransaction');

exports.getClientDashboard = async (req, res) => {
  try {
    if (!req.tenantDb) {
      return res.status(400).json({
        success: false,
        message: 'Tenant DB connection missing',
      });
    }

    const Patient = PatientModel(req.tenantDb);
    const MedicalBill = MedicalBillModel(req.tenantDb);
    const ItemCategory = ItemCategoryModel(req.tenantDb);
    const ItemMaster = ItemMasterModel(req.tenantDb);
    const StockTransaction = StockTransactionModel(req.tenantDb);

    const tenantId =
      req.query.tenantId ||
      req.user?.tenantId ||
      req.headers['x-tenant-id'];

    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    const transactionDateFilter = {
      date: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    const totalPatients = await Patient.countDocuments(dateFilter);

    const medicalPayments = await MedicalBill.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $ifNull: ['$paymentMode', 'Unknown'] },
          totalBills: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$grandTotal', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          paymentType: '$_id',
          totalBills: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const totalMedicalBilling = medicalPayments.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0
    );

    const totalCategories = await ItemCategory.countDocuments({
      isActive: true,
    });

    const totalItems = await ItemMaster.countDocuments();

    const activeItems = await ItemMaster.countDocuments({
      isActive: true,
      status: 'active',
    });

    const lowStockItems = await ItemMaster.countDocuments({
      $expr: {
        $lte: ['$currentStock', '$reorderLevel'],
      },
    });

    const outOfStockItems = await ItemMaster.countDocuments({
      currentStock: { $lte: 0 },
    });

    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const expiringItems = await ItemMaster.countDocuments({
      'batches.expiryDate': {
        $gte: today,
        $lte: next30Days,
      },
    });

    const inventoryValueAgg = await ItemMaster.aggregate([
      {
        $group: {
          _id: null,
          stockValue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$currentStock', 0] },
                { $ifNull: ['$purchasePrice', 0] },
              ],
            },
          },
          sellingValue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$currentStock', 0] },
                { $ifNull: ['$sellingPrice', 0] },
              ],
            },
          },
        },
      },
    ]);

    const inventoryValue = inventoryValueAgg[0]?.stockValue || 0;
    const inventorySellingValue = inventoryValueAgg[0]?.sellingValue || 0;

    const stockByCategory = await ItemMaster.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$categoryName', 'Unknown'] },
          totalStock: { $sum: { $ifNull: ['$currentStock', 0] } },
          totalItems: { $sum: 1 },
          stockValue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$currentStock', 0] },
                { $ifNull: ['$purchasePrice', 0] },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          categoryName: '$_id',
          totalStock: 1,
          totalItems: 1,
          stockValue: 1,
        },
      },
      { $sort: { stockValue: -1 } },
    ]);

    const stockTransactionsByType = await StockTransaction.aggregate([
      { $match: transactionDateFilter },
      {
        $group: {
          _id: '$transactionType',
          totalTransactions: { $sum: 1 },
          totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          transactionType: '$_id',
          totalTransactions: 1,
          totalQuantity: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const recentTransactions = await StockTransaction.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const lowStockList = await ItemMaster.find({
      $expr: {
        $lte: ['$currentStock', '$reorderLevel'],
      },
    })
      .select('itemId name categoryName currentStock reorderLevel sellingPrice')
      .sort({ currentStock: 1 })
      .limit(8)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        tenantId,
        month,
        year,

        sales: {
          totalPatients,
          totalMedicalBilling,
          medicalPayments,
        },

        inventory: {
          totalCategories,
          totalItems,
          activeItems,
          lowStockItems,
          outOfStockItems,
          expiringItems,
          inventoryValue,
          inventorySellingValue,
          stockByCategory,
          stockTransactionsByType,
          recentTransactions,
          lowStockList,
        },
      },
    });
  } catch (error) {
    console.error('Client dashboard error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch client dashboard',
      error: error.message,
    });
  }
};