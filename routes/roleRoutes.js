const express = require('express');
const multer = require('multer');

const {
  getRoles,
  createRole,
  updateRole,
  updateRoleStatus,
  deleteRole,
  importRoles,
} = require('../controllers/roleController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.patch('/:id/status', updateRoleStatus);
router.delete('/:id', deleteRole);
router.post('/import', upload.single('file'), importRoles);

module.exports = router;