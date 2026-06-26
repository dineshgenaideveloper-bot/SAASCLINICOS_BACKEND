const express = require('express');

const {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
} = require('../../controllers/tenant/roomController');

const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

const router = express.Router();

router.get('/', tenantMiddleware, getRooms);
router.get('/:id', tenantMiddleware, getRoomById);
router.post('/', tenantMiddleware, createRoom);
router.patch('/:id/status', tenantMiddleware, updateRoomStatus);
router.patch('/:id', tenantMiddleware, updateRoom);
router.delete('/:id', tenantMiddleware, deleteRoom);

module.exports = router;