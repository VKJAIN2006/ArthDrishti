/**
 * Seeds MongoDB from the retail dataset.
 *
 *   npm run seed
 *
 * - Upserts all products (latest stock / price / lead time)
 * - Loads the most recent SEED_DAYS of daily sales
 * - Creates a demo admin account
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const env = require('../config/env');
const { parseCsv } = require('../utils/csv.util');
const Product = require('../models/product.model');
const Sales = require('../models/sales.model');
const User = require('../models/user.model');

const SEED_DAYS = parseInt(process.env.SEED_DAYS || '600', 10);
const CSV_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'retail_inventory_dataset.csv');

const DEMO_ADMIN = {
  name: 'Store Admin',
  email: 'admin@arthdrishti.com',
  password: 'Admin@123',
  role: 'admin',
};
const DEMO_MANAGER = {
  name: 'Neha Sharma',
  email: 'manager@arthdrishti.com',
  password: 'Manager@123',
  role: 'manager',
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`✗ Dataset not found at ${CSV_PATH}`);
    process.exit(1);
  }

  console.log(`[seed] connecting to ${env.mongoUri}`);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`[seed] parsed ${rows.length} dataset rows`);

  const latest = new Map();
  const sales = [];
  let maxDate = new Date(0);

  for (const row of rows) {
    const pid = row.product_id;
    if (!pid) continue;
    const d = new Date(row.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d > maxDate) maxDate = d;

    const current = latest.get(pid);
    if (!current || d > current.date) latest.set(pid, { date: d, row });
    sales.push({ pid, date: d, row });
  }

  const cutoff = new Date(maxDate.getTime() - SEED_DAYS * 24 * 60 * 60 * 1000);
  const recentSales = sales.filter((s) => s.date >= cutoff);

  // --- products -------------------------------------------------------------
  const productOps = [];
  for (const [pid, { row }] of latest.entries()) {
    productOps.push({
      updateOne: {
        filter: { productId: pid },
        update: {
          $set: {
            productName: row.product_name || pid,
            category: row.category || 'Uncategorised',
            price: num(row.price, 0),
            currentStock: num(row.current_stock, 0),
            reorderLevel: num(row.reorder_level, 0),
            leadTimeDays: num(row.lead_time_days, 0),
          },
        },
        upsert: true,
      },
    });
  }
  const productResult = await Product.bulkWrite(productOps, { ordered: false });
  console.log(`[seed] products upserted: ${productResult.upsertedCount}, matched: ${productResult.matchedCount}`);

  // --- sales ----------------------------------------------------------------
  await Sales.deleteMany({});
  const seen = new Set();
  const salesDocs = [];
  for (const { pid, date, row } of recentSales) {
    const key = `${pid}|${date.toISOString().slice(0, 10)}`;
    if (seen.has(key)) continue; // dataset contains deliberate duplicates
    seen.add(key);
    salesDocs.push({
      productId: pid,
      date,
      unitsSold: num(row.units_sold, 0),
      price: num(row.price, 0),
      promotionFlag: num(row.promotion_flag, 0),
      isHoliday: num(row.is_holiday, 0),
      currentStock: num(row.current_stock, 0),
    });
  }

  const BATCH = 5000;
  let inserted = 0;
  for (let i = 0; i < salesDocs.length; i += BATCH) {
    const chunk = salesDocs.slice(i, i + BATCH);
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await Sales.insertMany(chunk, { ordered: false });
      inserted += res.length;
    } catch (error) {
      inserted += error.insertedDocs ? error.insertedDocs.length : 0;
      console.warn(`[seed] skipped ${chunk.length - (error.insertedDocs ? error.insertedDocs.length : 0)} duplicate sales rows`);
    }
  }
  console.log(`[seed] sales inserted: ${inserted} (last ${SEED_DAYS} days)`);

  // --- users ----------------------------------------------------------------
  for (const demo of [DEMO_ADMIN, DEMO_MANAGER]) {
    const existing = await User.findOne({ email: demo.email });
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await User.create(demo);
      console.log(`[seed] created user ${demo.email} / ${demo.password}`);
    } else {
      console.log(`[seed] user ${demo.email} already exists`);
    }
  }

  await Promise.all([Product.syncIndexes(), Sales.syncIndexes(), User.syncIndexes()]);

  console.log('[seed] done.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('[seed] failed:', error.message);
  process.exit(1);
});
