const crypto = require('crypto');
const Forecast = require('../models/forecast.model');
const Risk = require('../models/risk.model');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isDbConnected } = require('../config/db');
const ml = require('../services/ml.service');

/** GET /api/forecast/:productId */
const getForecast = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const horizon = parseInt(req.query.horizon, 10) || 7;
  const promotion = parseInt(req.query.promotion, 10) || 0;
  const price = req.query.price !== undefined && req.query.price !== '' ? Number(req.query.price) : undefined;

  const data = await ml.forecastProduct({
    product_id: productId,
    horizon_days: horizon,
    promotion_flag: promotion,
    price,
  });
  return sendSuccess(res, { data });
});

/** GET /api/forecast?horizon=7&category=Dairy&promotion=0 */
const getForecastBatch = asyncHandler(async (req, res) => {
  const horizon = parseInt(req.query.horizon, 10) || 7;
  const promotion = parseInt(req.query.promotion, 10) || 0;
  const category = req.query.category || undefined;
  const data = await ml.forecastBatch({ horizon_days: horizon, promotion_flag: promotion, category });
  return sendSuccess(res, { data });
});

/** GET /api/top-demand?n=10&horizon=7 */
const getTopDemand = asyncHandler(async (req, res) => {
  const n = parseInt(req.query.n, 10) || 10;
  const horizon = parseInt(req.query.horizon, 10) || 7;
  const data = await ml.topDemand({ n, horizon });
  return sendSuccess(res, { data });
});

/**
 * POST /api/forecasts/snapshot  (auth)
 * Generates a fresh forecast + risk snapshot and stores it in MongoDB so the
 * manager can revisit historical runs.
 */
const saveSnapshot = asyncHandler(async (req, res) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database is not connected.');
  const horizon = parseInt(req.body?.horizon_days, 10) || 7;
  const promotion = parseInt(req.body?.promotion_flag, 10) || 0;

  const { summary, items } = await ml.forecastBatch({
    horizon_days: horizon,
    promotion_flag: promotion,
  });
  const snapshotId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const forecastDocs = items.map((i) => ({
    productId: i.product_id,
    productName: i.product_name,
    category: i.category,
    snapshotId,
    horizonDays: horizon,
    predictedDemand: i.total_demand,
    avgDailyDemand: i.avg_daily_demand,
    promotionFlag: promotion,
  }));
  const riskDocs = items.map((i) => ({
    productId: i.product_id,
    productName: i.product_name,
    category: i.category,
    snapshotId,
    horizonDays: horizon,
    daysOfStockLeft: i.days_of_stock_left,
    riskLevel: i.risk_level,
    reorderQty: i.reorder_qty,
    action: i.action,
  }));

  await Promise.all([Forecast.insertMany(forecastDocs), Risk.insertMany(riskDocs)]);

  return sendSuccess(res, {
    statusCode: 201,
    message: `Snapshot saved for ${items.length} products (${horizon}-day horizon).`,
    data: { snapshotId, horizon_days: horizon, summary },
  });
});

/** GET /api/forecasts/history?limit=10 – recent snapshot runs */
const getSnapshotHistory = asyncHandler(async (req, res) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database is not connected.');
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const runs = await Forecast.aggregate([
    {
      $group: {
        _id: '$snapshotId',
        createdAt: { $max: '$createdAt' },
        horizonDays: { $first: '$horizonDays' },
        products: { $sum: 1 },
        totalDemand: { $sum: '$predictedDemand' },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
  ]);
  return sendSuccess(res, { data: { runs } });
});

module.exports = { getForecast, getForecastBatch, getTopDemand, saveSnapshot, getSnapshotHistory };
