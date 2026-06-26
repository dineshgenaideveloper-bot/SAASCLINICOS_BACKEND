const express = require('express');
const multer = require('multer');

const {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  addMaintenanceLog,
  getAssetCategories,
  getCategoryById,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
  importAssets,
  downloadAssetTemplate,
} = require('../../controllers/tenant/assetController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply tenant middleware to all asset routes
router.use(tenantMiddleware);

// Asset Import/Export
router.post('/import', upload.single('file'), importAssets);
router.get('/template', downloadAssetTemplate);

// Category routes (put these BEFORE /:id routes)
router.get('/categories/all', getAssetCategories);
router.post('/categories', createAssetCategory);
router.get('/categories/:id', getCategoryById);
router.patch('/categories/:id', updateAssetCategory);
router.delete('/categories/:id', deleteAssetCategory);

// SubCategory routes
router.post('/categories/:categoryId/subcategories', addSubCategory);
router.patch('/categories/:categoryId/subcategories/:subCategoryId', updateSubCategory);
router.delete('/categories/:categoryId/subcategories/:subCategoryId', deleteSubCategory);

// Asset CRUD routes
router.get('/', getAssets);
router.get('/:id', getAssetById);
router.post('/', createAsset);
router.patch('/:id', updateAsset);
router.delete('/:id', deleteAsset);

// Maintenance route
router.post('/:id/maintenance', addMaintenanceLog);

module.exports = router;