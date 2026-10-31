const Product = require('../models/product.model');
const Sales = require('../models/sales.model');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isDbConnected } = require('../config/db');
const ml = require('../services/ml.service');

function toApi(doc) {
  return {
    product_id: doc.productId,
    product_name: doc.productName,
    category: doc.category,
    price: doc.price,
    current_stock: doc.currentStock,
    reorder_level: doc.reorderLevel,
    lead_time_days: doc.leadTimeDays,
  };
}

const listProducts = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 100 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));

  if (isDbConnected()) {
    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      Product.find(query).sort({ productId: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Product.countDocuments(query),
    ]);
    if (total > 0) {
      return sendSuccess(res, {
        data: { total, page: pageNum, limit: limitNum, items: items.map(toApi) },
      });
    }
    // DB connected but empty (not seeded) -> fall through to the ML catalog.
  }

  // Fallback: ML service catalog
  const payload = await ml.listProducts({ category, search });
  const start = (pageNum - 1) * limitNum;
  return sendSuccess(res, {
    data: { total: payload.count, page: pageNum, limit: limitNum, items: payload.items.slice(start, start + limitNum) },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (isDbConnected()) {
    const doc = await Product.findOne({ productId: id });
    if (doc) return sendSuccess(res, { data: toApi(doc) });
  }
  const payload = await ml.getProduct(id);
  return sendSuccess(res, { data: payload });
});

const getProductHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const days = Math.min(500, Math.max(1, parseInt(req.query.days, 10) || 60));

  if (isDbConnected()) {
    const docs = await Sales.find({ productId: id }).sort({ date: -1 }).limit(days);
    if (docs.length) {
      const items = docs
        .map((d) => ({ date: d.date.toISOString().slice(0, 10), units_sold: d.unitsSold }))
        .reverse();
      return sendSuccess(res, { data: { product_id: id, days, items } });
    }
  }
  const payload = await ml.getHistory(id, days);
  return sendSuccess(res, { data: payload });
});

const getCategories = asyncHandler(async (req, res) => {
  if (isDbConnected()) {
    const items = await Product.distinct('category');
    if (items.length) return sendSuccess(res, { data: { items: items.sort() } });
  }
  const payload = await ml.categories();
  return sendSuccess(res, { data: payload });
});

const getStats = asyncHandler(async (req, res) => {
  if (isDbConnected()) {
    const [products, categories, agg] = await Promise.all([
      Product.countDocuments(),
      Product.distinct('category'),
      Sales.aggregate([
        {
          $group: {
            _id: null,
            totalUnits: { $sum: '$unitsSold' },
            revenue: { $sum: { $multiply: ['$unitsSold', '$price'] } },
            records: { $sum: 1 },
            first: { $min: '$date' },
            last: { $max: '$date' },
          },
        },
      ]),
    ]);
    if (products) {
      const a = agg[0] || {};
      return sendSuccess(res, {
        data: {
          products,
          categories: categories.length,
          category_list: categories.sort(),
          records: a.records || 0,
          date_from: a.first ? new Date(a.first).toISOString().slice(0, 10) : null,
          date_to: a.last ? new Date(a.last).toISOString().slice(0, 10) : null,
          total_units_sold: Math.round(a.totalUnits || 0),
          total_revenue: Math.round((a.revenue || 0) * 100) / 100,
          avg_daily_units: a.records ? Math.round(((a.totalUnits || 0) / a.records) * 100) / 100 : 0,
          units_by_category: [],
        },
      });
    }
  }
  const payload = await ml.overview();
  return sendSuccess(res, { data: payload });
});

const createProduct = asyncHandler(async (req, res) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database is not connected.');
  const { product_id, product_name, category, price, current_stock, reorder_level, lead_time_days } =
    req.body || {};
  if (!product_id || !product_name || !category) {
    throw ApiError.badRequest('product_id, product_name and category are required.');
  }
  const doc = await Product.create({
    productId: product_id,
    productName: product_name,
    category,
    price: price ?? 0,
    currentStock: current_stock ?? 0,
    reorderLevel: reorder_level ?? 0,
    leadTimeDays: lead_time_days ?? 0,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Product created.', data: toApi(doc) });
});

const updateStock = asyncHandler(async (req, res) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database is not connected.');
  const { id } = req.params;
  const { current_stock } = req.body || {};
  if (current_stock === undefined) throw ApiError.badRequest('current_stock is required.');
  const doc = await Product.findOneAndUpdate(
    { productId: id },
    { currentStock: Number(current_stock) },
    { new: true }
  );
  if (!doc) throw ApiError.notFound(`Product '${id}' not found.`);
  return sendSuccess(res, { message: 'Stock updated.', data: toApi(doc) });
});

module.exports = {
  listProducts,
  getProduct,
  getProductHistory,
  getCategories,
  getStats,
  createProduct,
  updateStock,
};
