// server/config/tenantDb.js
const mongoose = require('mongoose');

const connections = {};

const getTenantDB = async (tenantId) => {
  if (!tenantId) throw new Error("Tenant ID missing");

  if (connections[tenantId]) {
    return connections[tenantId];
  }

  const dbName = `clinicos_${tenantId}`;

const conn = await mongoose.createConnection(process.env.MONGO_URI);

  connections[tenantId] = conn;
  console.log(`Connected to tenant DB: ${dbName}`);

  return conn;
};

module.exports = {
  getTenantDB,
};
