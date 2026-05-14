const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Component template — defines what components a product type uses
const componentSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  checked:       { type: Boolean, default: false },
  linkedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  quantity:      { type: Number, default: 1, min: 1 },
  canSellSeparately: { type: Boolean, default: false },
  canMove:           { type: Boolean, default: true },
});

// Per-unit component instance — tracks state of one component in one physical unit
const unitComponentSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  linkedProduct:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  linkedProductName: { type: String }, // snapshot
  quantity:       { type: Number, default: 1, min: 1 },
  // Status of this component instance
  status: {
    type: String,
    enum: ['installed', 'sold', 'moved', 'missing'],
    default: 'installed',
  },
  // If sold: reference to the sale
  soldAt:     { type: Date },
  // If moved: which unit it went to
  movedToUnit: { type: String },
});

// One physical unit of the product
const unitSchema = new mongoose.Schema({
  unitNumber: { type: Number, required: true }, // 1, 2, 3...
  unitLabel:  { type: String },
  qrCodeId:   { type: String },  // unique ID encoded in QR
  qrCode:     { type: String },  // base64 PNG data URL
  components: [unitComponentSchema],
  notes:      { type: String, maxlength: 300 },
  createdAt:  { type: Date, default: Date.now },
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
  price:    { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  quantityAssembled: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
  description: { type: String, trim: true, maxlength: 500 },
  qrCode:   { type: String },
  qrCodeId: { type: String, unique: true, default: () => uuidv4() },

  // Component TEMPLATE — defines what components this product type uses
  // (used when creating new units)
  components: [componentSchema],

  // PER-UNIT tracking — one entry per physical unit in stock
  units: [unitSchema],

  imageUrl:  { type: String, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

productSchema.virtual('stockStatus').get(function () {
  if (this.quantity === 0) return 'out_of_stock';
  if (this.quantity <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});
productSchema.virtual('quantityFree').get(function () {
  return Math.max(0, this.quantity - (this.quantityAssembled || 0));
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, quantity: 1, price: 1 });

module.exports = mongoose.model('Product', productSchema);