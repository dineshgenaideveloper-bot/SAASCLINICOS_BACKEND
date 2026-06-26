// server/utils/helpers.js

/**
 * Generate a sequential ID with a prefix and zero-padded number
 * e.g. generateId('PT', 42) => 'PT-00042'
 */
const generateId = (prefix, count) => {
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

/**
 * Paginate a mongoose query
 * @param {Object} query - Mongoose query object
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 */
const paginate = async (query, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    query.skip(skip).limit(limit).lean(),
    query.model.countDocuments(query.getFilter()),
  ]);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Sanitize an object by removing undefined/null keys
 */
const sanitizeObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
};

/**
 * Format currency in INR
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

module.exports = { generateId, paginate, sanitizeObject, formatCurrency };
