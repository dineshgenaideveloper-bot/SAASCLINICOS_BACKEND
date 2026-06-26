// server/controllers/tenant/departmentFieldConfigController.js
const DepartmentFieldConfigModel = require('../../models/tenant/DepartmentFieldConfig');

// Get all department field configurations
exports.getAllConfigs = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const configs = await DepartmentFieldConfig.find({ isActive: true })
      .sort({ departmentName: 1 });

    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Error in getAllConfigs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get configuration for a specific department
exports.getConfigByDepartment = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { departmentName } = req.params;

    let config = await DepartmentFieldConfig.findOne({
      departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') },
      isActive: true,
    });

    if (!config) {
      // Return default configuration if none exists
      config = {
        departmentName,
        fields: [],
        layout: 'two-column',
      };
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error in getConfigByDepartment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or update department field configuration
exports.upsertConfig = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { departmentName } = req.params;
    const { fields, layout, sections, departmentCode } = req.body;

    // Validate fields structure
    if (fields && !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        message: 'Fields must be an array',
      });
    }

    // Sort fields by order
    const sortedFields = fields ? fields.sort((a, b) => (a.order || 0) - (b.order || 0)) : [];

    const config = await DepartmentFieldConfig.findOneAndUpdate(
      { departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') } },
      {
        departmentName,
        departmentCode: departmentCode || '',
        fields: sortedFields,
        layout: layout || 'two-column',
        sections: sections || {},
        $inc: { version: 1 },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Department field configuration saved successfully',
      data: config,
    });
  } catch (error) {
    console.error('Error in upsertConfig:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a specific field from a department
exports.deleteField = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { departmentName, fieldKey } = req.params;

    const config = await DepartmentFieldConfig.findOne({
      departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    config.fields = config.fields.filter(field => field.key !== fieldKey);
    config.$inc = { version: 1 };
    await config.save();

    res.json({
      success: true,
      message: 'Field deleted successfully',
      data: config,
    });
  } catch (error) {
    console.error('Error in deleteField:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reorder fields
exports.reorderFields = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { departmentName } = req.params;
    const { fieldOrders } = req.body; // Array of { key, order }

    const config = await DepartmentFieldConfig.findOne({
      departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    // Update order for each field
    fieldOrders.forEach(({ key, order }) => {
      const field = config.fields.find(f => f.key === key);
      if (field) {
        field.order = order;
      }
    });

    // Sort fields by order
    config.fields.sort((a, b) => (a.order || 0) - (b.order || 0));
    await config.save();

    res.json({
      success: true,
      message: 'Fields reordered successfully',
      data: config,
    });
  } catch (error) {
    console.error('Error in reorderFields:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete entire department configuration
exports.deleteConfig = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { departmentName } = req.params;

    const result = await DepartmentFieldConfig.findOneAndDelete({
      departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') },
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found',
      });
    }

    res.json({
      success: true,
      message: 'Department configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteConfig:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clone configuration from one department to another
exports.cloneConfig = async (req, res) => {
  try {
    const DepartmentFieldConfig = DepartmentFieldConfigModel(req.tenantDb);
    const { sourceDepartment, targetDepartment } = req.body;

    const sourceConfig = await DepartmentFieldConfig.findOne({
      departmentName: { $regex: new RegExp(`^${sourceDepartment}$`, 'i') },
    });

    if (!sourceConfig) {
      return res.status(404).json({
        success: false,
        message: 'Source configuration not found',
      });
    }

    const newConfig = new DepartmentFieldConfig({
      departmentName: targetDepartment,
      departmentCode: sourceConfig.departmentCode,
      fields: sourceConfig.fields.map(field => ({
        ...field.toObject(),
        _id: undefined, // Create new IDs
      })),
      layout: sourceConfig.layout,
      sections: sourceConfig.sections,
      version: 1,
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'Configuration cloned successfully',
      data: newConfig,
    });
  } catch (error) {
    console.error('Error in cloneConfig:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};