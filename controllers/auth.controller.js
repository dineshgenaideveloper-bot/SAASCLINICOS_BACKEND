// server/controllers/auth.controller.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

const User = require('../models/User');
const Clinic = require('../models/Clinic');
const SubscriptionPermission = require('../models/SubscriptionPermission');

const config = require('../config/config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/error.middleware');

const generateTenantId = async () => {
  const lastClinic = await Clinic.findOne({}, 'tenantId').sort({ createdAt: -1 });

  let nextNumber = 1;

  if (lastClinic?.tenantId) {
    const match = lastClinic.tenantId.match(/CLINIC(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  return `CLINIC${nextNumber.toString().padStart(6, '0')}`;
};

const signAccessToken = (id) =>
  jwt.sign({ id }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpire,
  });

const signRefreshToken = (id) =>
  jwt.sign({ id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  });

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  maxAge: maxAgeMs,
});

const populateUser = (query) =>
  query
    .populate('clinic', 'name gstin address contact tenantId')
    .populate(
      'features',
      'featureCode name module path icon textLink price description'
    );

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const sendTokens = async (user, statusCode, res) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  const hashedRefresh = hashToken(refreshToken);

  await User.findByIdAndUpdate(user._id, {
    $push: {
      refreshTokens: hashedRefresh,
    },
    lastLogin: Date.now(),
  });

  const freshUser = await populateUser(User.findById(user._id));

  res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

  return res.status(statusCode).json({
    status: 'success',
    accessToken,
    data: {
      user: freshUser.toSafeObject(),
    },
  });
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: 'fail',
        errors: errors.array(),
      });
    }

    const { name, email, password, role, clinicName, clinicCity } = req.body;

    const tenantId = await generateTenantId();

    const clinic = await Clinic.create({
      name: clinicName || `${name}'s Clinic`,
      address: {
        city: clinicCity || '',
      },
      tenantId,
    });

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'admin',
      clinic: clinic._id,
      tenantId: clinic.tenantId,
      isActive: false,
    });

    clinic.owner = user._id;
    await clinic.save();

    logger.info(`New user registered: ${email} for tenant: ${tenantId}`);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please complete account activation.',
      data: {
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  console.log('Login attempt:', req.body.email);
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: 'fail',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    const user = await populateUser(
      User.findOne({ email }).select('+password +refreshTokens')
    );

    if (!user) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isActive && user.role !== 'clinicossaassadmin') {
      return next(
        new AppError(
          'Your account is inactive. Please complete activation payment.',
          403
        )
      );
    }

    if (user.role !== 'clinicossaassadmin') {
      const permission = await SubscriptionPermission.findOne({
        tenantId: user.tenantId,
        isActive: true,
      });

      if (!permission) {
        return next(
          new AppError(
            'Subscription is not active for this clinic. Please contact admin.',
            403
          )
        );
      }

      const allowedLoginCount = permission.loginCount || 1;

      const tenantUsers = await User.find({
        tenantId: user.tenantId,
      }).select('+refreshTokens');

      let activeLoginCount = 0;

      tenantUsers.forEach((tenantUser) => {
        activeLoginCount += tenantUser.refreshTokens?.length || 0;
      });

      if (activeLoginCount >= allowedLoginCount) {
        return next(
          new AppError(
            `Login limit reached. Only ${allowedLoginCount} active login allowed.`,
            403
          )
        );
      }
    }

    await sendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return next(new AppError('No refresh token.', 401));
    }

    let decoded;

    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch {
      return next(new AppError('Invalid refresh token.', 401));
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      _id: decoded.id,
      refreshTokens: hashedToken,
      isActive: true,
    }).select('+refreshTokens');

    if (!user) {
      return next(
        new AppError('Refresh token reuse detected. Please log in again.', 401)
      );
    }

    await User.findByIdAndUpdate(user._id, {
      $pull: {
        refreshTokens: hashedToken,
      },
    });

    await sendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token && req.user?._id) {
      const hashedToken = hashToken(token);

      await User.findByIdAndUpdate(req.user._id, {
        $pull: {
          refreshTokens: hashedToken,
        },
      });
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({
      status: 'success',
      message: 'Logged out.',
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await populateUser(User.findById(req.user._id));

    return res.status(200).json({
      status: 'success',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select(
      '+password +refreshTokens'
    );

    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 400));
    }

    user.password = newPassword;
    user.refreshTokens = [];

    await user.save();

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({
      status: 'success',
      message: 'Password updated. Please log in again.',
    });
  } catch (err) {
    next(err);
  }
};