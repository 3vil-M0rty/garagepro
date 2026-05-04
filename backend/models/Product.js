const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const componentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  checked: { type: Boolean, default: false },
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters'],
  },
  sku: {
    type: String,
    unique: true,
    default: () => `SKU-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0,
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: 0,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  qrCode: {
    type: String, // base64 data URL
  },
  qrCodeId: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  components: [componentSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function () {
  if (this.quantity === 0) return 'out_of_stock';
  if (this.quantity <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Text search index
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, quantity: 1, price: 1 });

module.exports = mongoose.model('Product', productSchema);
