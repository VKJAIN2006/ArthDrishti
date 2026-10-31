const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    currentStock: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, required: true, min: 0 },
    leadTimeDays: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ productName: 'text' });

module.exports = mongoose.model('Product', productSchema);
