// server/models/tenant/DepartmentFieldConfig.js
const mongoose = require('mongoose');

const departmentFieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'textarea', 'select', 'number', 'date', 'checkbox', 'radio'],
      default: 'text',
    },
    options: {
      type: [String],
      default: [],
    },
    placeholder: {
      type: String,
      default: '',
    },
    required: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validation: {
      min: Number,
      max: Number,
      pattern: String,
    },
    section: {
      type: String,
      default: 'general',
    },
  },
  { _id: true }
);

const departmentFieldConfigSchema = new mongoose.Schema(
  {
    departmentName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    departmentCode: {
      type: String,
      trim: true,
    },
    fields: {
      type: [departmentFieldSchema],
      default: [],
    },
    layout: {
      type: String,
      enum: ['grid', 'single-column', 'two-column', 'accordion'],
      default: 'two-column',
    },
    sections: {
      type: Map,
      of: String,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

const DepartmentFieldConfigModel = (connection) => {
  return connection.models.DepartmentFieldConfig ||
    connection.model('DepartmentFieldConfig', departmentFieldConfigSchema);
};

module.exports = DepartmentFieldConfigModel;