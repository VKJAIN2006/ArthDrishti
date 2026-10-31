const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    productName: String,
    category: String,
    snapshotId: { type: String, index: true },
    forecastDate: { type: Date, default: Date.now },
    horizonDays: { type: Number, default: 7 },
    daysOfStockLeft: Number,
    riskLevel: { type: String, enum: ['High', 'Medium', 'Safe', 'Overstocked'] },
    reorderQty: { type: Number, default: 0 },
    action: String,
  },
  { timestamps: true }
);

riskSchema.index({ riskLevel: 1, createdAt: -1 });

module.exports = mongoose.model('Risk', riskSchema);
