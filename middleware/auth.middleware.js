// server/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const AppError = require('./error.middleware').AppError;

/**
 * Verify access token and attach user to request
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Get token from Authorization header or httpOnly cookie
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Not authenticated. Please log in.', 401));
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Session expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid token.', 401));
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user || !user.isActive) {
      return next(new AppError('User no longer exists or is deactivated.', 401));
    }

    // 4. Check if password changed after token was issued
    if (user.passwordChangedAfter(decoded.iat)) {
      return next(new AppError('Password recently changed. Please log in again.', 401));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control
 * Usage: authorize('admin', 'doctor')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Role '${req.user.role}' is not authorized for this action.`, 403));
    }
    next();
  };
};

/**
 * Ensure user belongs to the same clinic as the resource
 */
const sameClinic = (req, res, next) => {
  const clinicId = req.params.clinicId || req.body.clinic;
  if (req.user.role !== 'admin' && clinicId && req.user.clinic?.toString() !== clinicId) {
    return next(new AppError('Access denied: clinic mismatch.', 403));
  }
  next();
};

module.exports = { protect, authorize, sameClinic };
