const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      required: true,
    },

    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
    },

    roomType: {
      type: String,
      enum: ['general', 'private', 'semi_private', 'icu', 'nicu', 'picu', 'emergency', 'operation', 'consultation', 'other'],
      default: 'general',
    },

    floor: {
      type: String,
      trim: true,
    },

    capacity: {
      type: Number,
      default: 1,
      min: 1,
    },

    dailyCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

roomSchema.index({ ward: 1, roomNumber: 1 }, { unique: true });

roomSchema.pre('validate', async function (next) {
  if (!this.roomId) {
    const count = await this.constructor.countDocuments();
    this.roomId = `ROM-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

const RoomModel = (connection) => {
  return connection.models.Room || connection.model('Room', roomSchema);
};

module.exports = RoomModel;