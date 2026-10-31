const express = require('express');
const c = require('../controllers/catalog.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/products', c.listProducts);
router.post('/products', requireAuth, requireRole('admin', 'manager'), c.createProduct);
router.get('/products/:id/history', c.getProductHistory);
router.get('/products/:id', c.getProduct);
router.patch('/products/:id/stock', requireAuth, requireRole('admin', 'manager'), c.updateStock);

router.get('/categories', c.getCategories);
router.get('/stats/overview', c.getStats);

module.exports = router;
