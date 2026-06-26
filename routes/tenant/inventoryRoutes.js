const express = require('express');
const multer = require('multer');

const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  updateStock,
  getStockTransactions,
  getLowStockItems,
  getExpiringItems,
  importItems,
  downloadTemplate
} = require('../../controllers/tenant/inventoryController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(tenantMiddleware);

// Category routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Item routes
router.get('/items', getItems);
router.get('/items/:id', getItemById);
router.post('/items', createItem);
router.patch('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

// Stock routes
router.patch('/items/:id/stock', updateStock);
router.get('/transactions', getStockTransactions);
router.get('/reports/low-stock', getLowStockItems);
router.get('/reports/expiring', getExpiringItems);

// Import/Export
router.post('/import', upload.single('file'), importItems);
router.get('/template', downloadTemplate);

module.exports = router;