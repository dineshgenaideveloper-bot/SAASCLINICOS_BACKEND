// server/config/tenantDb.js
import mongoose from "mongoose";

const connections = {};

export const getTenantDB = async (tenantId) => {
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