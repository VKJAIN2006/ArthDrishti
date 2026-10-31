const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    productName: String,
    category: String,
    snapshotId: { type: String, index: true },
    forecastDate: { type: Date, default: Date.now },
    horizonDays: { type: Number, enum: [7, 14, 30], default: 7 },
    predictedDemand: { type: Number, required: true },
    avgDailyDemand: Number,
    promotionFlag: { type: Number, default: 0 },
  },
  { timestamps: true }
);

forecastSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('Forecast', forecastSchema);
