const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters'],
  },
  color: {
    type: String,
    default: '#6366f1',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color'],
  },
  // Parent category — null means top-level
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  // If this is a "composants" subcategory, link to the parent's component products
  isComponentCategory: {
    type: Boolean,
    default: false,
  },
  defaultComponents: [{
    name: { type: String, required: true, trim: true },
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// Compound unique: name must be unique within the same parent scope
categorySchema.index({ name: 1, parent: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
