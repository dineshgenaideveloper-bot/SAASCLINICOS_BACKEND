// server/routes/tenant/departmentFieldConfigRoutes.js
const express = require('express');
const {
  getAllConfigs,
  getConfigByDepartment,
  upsertConfig,
  deleteField,
  reorderFields,
  deleteConfig,
  cloneConfig,
} = require('../../controllers/tenant/departmentFieldConfigController');
const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.use(tenantMiddleware);

// Get all configurations
router.get('/', getAllConfigs);

// Get config for specific department
router.get('/:departmentName', getConfigByDepartment);

// Create/update config for department
router.put('/:departmentName', upsertConfig);

// Delete entire config
router.delete('/:departmentName', deleteConfig);

// Delete specific field
router.delete('/:departmentName/fields/:fieldKey', deleteField);

// Reorder fields
router.patch('/:departmentName/reorder', reorderFields);

// Clone config from one department to another
router.post('/clone', cloneConfig);

module.exports = router;