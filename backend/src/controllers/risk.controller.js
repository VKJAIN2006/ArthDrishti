const Risk = require('../models/risk.model');
const { sendSuccess } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isDbConnected } = require('../config/db');
const ApiError = require('../utils/ApiError');
const ml = require('../services/ml.service');

/** GET /api/risk?horizon=7&level=high&category=Dairy&search=milk */
const getRisk = asyncHandler(async (req, res) => {
  const horizon = parseInt(req.query.horizon, 10) || 7;
  const data = await ml.risk({
    horizon,
    level: req.query.level || undefined,
    category: req.query.category || undefined,
    search: req.query.search || undefined,
  });
  return sendSuccess(res, { data });
});

/** GET /api/risk/history?limit=100 – most recent saved risk rows */
const getRiskHistory = asyncHandler(async (req, res) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database is not connected.');
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const docs = await Risk.find().sort({ createdAt: -1 }).limit(limit);
  return sendSuccess(res, { data: { count: docs.length, items: docs } });
});

module.exports = { getRisk, getRiskHistory };
