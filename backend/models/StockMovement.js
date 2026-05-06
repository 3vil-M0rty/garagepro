const mongoose = require('mongoose');

/**
 * StockMovement — tracks every quantity change on a product
 * Reasons:
 *   sale          — sold via sales module
 *   sale_cancel   — sale deleted, stock restored
 *   assembly      — used as component when assembling a parent product
 *   disassembly   — returned when parent product is deleted / component removed
 *   component_sold — component sold separately from parent
 *   component_moved — component moved to another parent product
 *   manual_in     — manual stock increase (admin)
 *   manual_out    — manual stock decrease (admin)
 *   initial       — initial stock set on product creation
 */
const stockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: { type: String }, // snapshot
  productSku:  { type: String }, // snapshot

  reason: {
    type: String,
    enum: ['sale', 'sale_cancel', 'assembly', 'disassembly',
           'component_sold', 'component_moved', 'manual_in', 'manual_out', 'initial'],
    required: true,
  },

  // Positive = stock IN, Negative = stock OUT
  delta: { type: Number, required: true },

  // Quantity before and after
  quantityBefore: { type: Number, required: true },
  quantityAfter:  { type: Number, required: true },

  // Contextual references
  relatedSale:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  relatedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // parent or target
  relatedProductName: { type: String },

  note:   { type: String, maxlength: 300 },
  doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doneByName: { type: String },
}, { timestamps: true });

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ reason: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
