const LoginPrice = require('../models/LoginPrice');

// GET
exports.getLoginPrices = async (req, res) => {
  try {
    const prices = await LoginPrice.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch login prices',
      error: error.message,
    });
  }
};

// CREATE
exports.createLoginPrice = async (req, res) => {
  try {
    const price = await LoginPrice.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Login price created successfully',
      data: price,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create login price',
      error: error.message,
    });
  }
};

// UPDATE
exports.updateLoginPrice = async (req, res) => {
  try {
    const price = await LoginPrice.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Login price not found',
      });
    }

    res.json({
      success: true,
      message: 'Login price updated successfully',
      data: price,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update login price',
      error: error.message,
    });
  }
};

// DELETE
exports.deleteLoginPrice = async (req, res) => {
  try {
    const price = await LoginPrice.findByIdAndDelete(
      req.params.id
    );

    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Login price not found',
      });
    }

    res.json({
      success: true,
      message: 'Login price deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete login price',
      error: error.message,
    });
  }
};

// STATUS
exports.updateLoginPriceStatus = async (
  req,
  res
) => {
  try {
    const { isActive } = req.body;

    const price = await LoginPrice.findByIdAndUpdate(
      req.params.id,
      { isActive },
      {
        new: true,
      }
    );

    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Login price not found',
      });
    }

    res.json({
      success: true,
      data: price,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message,
    });
  }
};