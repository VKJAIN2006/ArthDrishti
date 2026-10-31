const mongoose = require('mongoose');

const salesSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  unitsSold: { type: Number, required: true },
  price: Number,
  promotionFlag: { type: Number, default: 0 },
  isHoliday: { type: Number, default: 0 },
  currentStock: Number,
});
salesSchema.index({ productId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Sales', salesSchema);
