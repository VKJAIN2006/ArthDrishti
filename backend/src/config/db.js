/**
 * MongoDB connection helper.
 *
 * The server intentionally does NOT exit when Mongo is unavailable: it starts
 * in a "degraded" mode where product/stat endpoints fall back to the ML
 * service and DB-only endpoints return a clear 503 error.
 */
const mongoose = require('mongoose');
const env = require('./env');

let connected = false;

async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log(`[db] connected to ${env.mongoUri}`);
  } catch (error) {
    connected = false;
    console.warn(`[db] could not connect to MongoDB (${error.message}).`);
    console.warn('[db] Starting in degraded mode — DB features (auth, contact, snapshots) are disabled.');
  }
  return connected;
}

function isDbConnected() {
  return connected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbConnected };
