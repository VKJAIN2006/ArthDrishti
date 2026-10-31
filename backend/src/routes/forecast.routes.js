const express = require('express');
const c = require('../controllers/forecast.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/forecast', c.getForecastBatch);
router.get('/forecast/:productId', c.getForecast);
router.get('/top-demand', c.getTopDemand);

router.post('/forecasts/snapshot', requireAuth, c.saveSnapshot);
router.get('/forecasts/history', requireAuth, c.getSnapshotHistory);

module.exports = router;
