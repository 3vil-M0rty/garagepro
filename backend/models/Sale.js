const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: { type: String, required: true }, // snapshot
  productSku: { type: String },
  category: { type: String }, // snapshot
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const saleSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    unique: true,
  },
  quoteNumber: { type: String, unique: true, sparse: true },
  clientName:  { type: String, trim: true, default: '' },
  clientPhone: { type: String, trim: true, default: '' },
  clientAddress: { type: String, trim: true, default: '' },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sellerName: { type: String }, // snapshot
  notes: { type: String, maxlength: 300 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'other'],
    default: 'cash',
  },
}, { timestamps: true });

// Auto-generate receipt number
saleSchema.pre('save', async function (next) {
  if (!this.receiptNumber) {
    const count = await mongoose.model('Sale').countDocuments();
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    this.receiptNumber = `REC-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  if (!this.quoteNumber) {
    const count = await mongoose.model('Sale').countDocuments();
    const date = new Date();
    this.quoteNumber = `DEV-${date.getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

saleSchema.index({ createdAt: -1 });
saleSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
