const express = require('express');

const {
  getFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  updateFeatureStatus,
} = require('../controllers/featureController');

const router = express.Router();

router.get('/', getFeatures);
router.get('/:id', getFeatureById);
router.post('/', createFeature);
router.patch('/:id', updateFeature);
router.delete('/:id', deleteFeature);
router.patch('/:id/status', updateFeatureStatus);

module.exports = router;