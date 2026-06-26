const express = require('express');
const multer = require('multer');

const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  updateDepartmentStatus,
  importDepartments,
} = require('../controllers/departmentController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.get('/', getDepartments);
router.post('/', createDepartment);
router.post('/import', upload.single('file'), importDepartments);
router.patch('/:id', updateDepartment);
router.patch('/:id/status', updateDepartmentStatus);
router.delete('/:id', deleteDepartment);

module.exports = router;