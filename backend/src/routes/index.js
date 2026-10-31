const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isDbConnected } = require('../config/db');
const ml = require('../services/ml.service');

const authRoutes = require('./auth.routes');
const catalogRoutes = require('./catalog.routes');
const forecastRoutes = require('./forecast.routes');
const riskRoutes = require('./risk.routes');
const contactRoutes = require('./contact.routes');

const router = express.Router();

// Aggregated health check (backend + ML service + database)
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    let mlStatus = 'unknown';
    let mlDetails = null;
    try {
      mlDetails = await ml.health();
      mlStatus = 'ok';
    } catch (error) {
      mlStatus = 'unavailable';
      mlDetails = { message: error.message };
    }
    res.json({
      success: true,
      message: 'ArthDrishti API',
      data: {
        backend: 'ok',
        database: isDbConnected() ? 'connected' : 'disconnected',
        mlService: mlStatus,
        ml: mlDetails,
        time: new Date().toISOString(),
      },
    });
  })
);

router.use('/auth', authRoutes);
router.use('/', catalogRoutes);
router.use('/', forecastRoutes);
router.use('/', riskRoutes);
router.use('/contact', contactRoutes);

module.exports = router;
