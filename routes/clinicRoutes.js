// server/routes/clinicRoutes.js

const express = require('express');
const {
  getClinics,
  getClinicById,
  getClinicUsers,
  updateClinic,
  deleteClinic,
  updateClinicUserStatus,
  deleteClinicUser,
  getClinicStorageInfo,
  clearClinicStorage,
  clearCollection,
  exportCollectionData,
  getAllTenantsStorage,
} = require('../controllers/clinicController');

const router = express.Router();

// Specific routes first
router.get('/all-tenants-storage', getAllTenantsStorage);

// Clinic user routes
router.patch('/users/:userId/status', updateClinicUserStatus);
router.delete('/users/:userId', deleteClinicUser);

// Clinic storage routes
router.get('/:id/storage/:collectionName/export', exportCollectionData);
router.delete('/:id/storage/:collectionName', clearCollection);
router.delete('/:id/storage', clearClinicStorage);
router.get('/:id/storage', getClinicStorageInfo);

router.get('/:id/users', getClinicUsers);

// Generic routes last
router.get('/', getClinics);
router.get('/:id', getClinicById);
router.patch('/:id', updateClinic);
router.delete('/:id', deleteClinic);

module.exports = router;
