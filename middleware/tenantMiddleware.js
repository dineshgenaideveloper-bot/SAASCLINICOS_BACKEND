// server/middleware/tenantMiddleware.js

const mongoose = require('mongoose');

const connections = new Map();

const getTenantConnection = async (tenantId) => {
  if (connections.has(tenantId)) {
    return connections.get(tenantId);
  }

  const dbName = `clinicos_${tenantId}`;

  const connection = mongoose.createConnection(
    `mongodb://127.0.0.1:27017/${dbName}`,
    {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  );

  await connection.asPromise();

  connections.set(tenantId, connection);

  console.log(`Connected to tenant DB: ${dbName}`);

  return connection;
};

const tenantMiddleware = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID missing',
      });
    }

    req.tenantId = tenantId;
    req.tenantDb = await getTenantConnection(tenantId);

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Tenant DB connection failed',
      error: error.message,
    });
  }
};

module.exports = {
  tenantMiddleware,
};