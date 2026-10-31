/**
 * Centralised environment configuration.
 * Everything reads from here so there is a single source of truth.
 */
require('dotenv').config();

const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.DATABASE || 'mongodb://localhost:27017/Workshop',
  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'arthdrishti-dev-secret-change-me',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

module.exports = env;
