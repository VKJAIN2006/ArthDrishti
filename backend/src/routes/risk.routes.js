const express = require('express');
const c = require('../controllers/risk.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/risk', c.getRisk);
router.get('/risk/history', requireAuth, c.getRiskHistory);

module.exports = router;
