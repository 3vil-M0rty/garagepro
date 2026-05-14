const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
  },
  // Snapshot of unit info at time of loan
  unitSerial:   { type: String },
  productName:  { type: String },

  borrowerName:  { type: String, required: true, trim: true },
  borrowerPhone: { type: String, trim: true },
  borrowerType: {
    type: String,
    enum: ['client', 'garage', 'mechanic', 'employee'],
    default: 'client',
  },
  lentAt:            { type: Date, default: Date.now },
  expectedReturnAt:  { type: Date },
  returnedAt:        { type: Date, default: null },
  depositAmount:     { type: Number, default: 0 },
  notes:             { type: String, maxlength: 500 },
  status: {
    type: String,
    enum: ['active', 'returned', 'overdue'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

loanSchema.index({ status: 1, expectedReturnAt: 1 });
loanSchema.index({ unit: 1 });

module.exports = mongoose.model('Loan', loanSchema);
