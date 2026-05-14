const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  serialNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: ['available', 'sold', 'lent', 'installed', 'dismantled', 'retired'],
    default: 'available',
  },
  condition: {
    type: String,
    enum: ['new', 'good', 'worn', 'for_parts'],
    default: 'good',
  },
  purchasePrice: { type: Number, default: 0 },
  salePrice:     { type: Number, default: null },
  notes:         { type: String, maxlength: 500 },
  // QR and image
  qrCode:   { type: String },
  qrCodeId: { type: String },
  // Soft delete
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

unitSchema.index({ product: 1, status: 1 });
unitSchema.index({ serialNumber: 1 });

module.exports = mongoose.model('Unit', unitSchema);
