const Product = require('../models/Product');
const { generateQRCode } = require('../utils/qrGenerator');

// @desc    Get all products with search/filter
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res, next) => {
  try {
    const {
      search, category, minPrice, maxPrice,
      availability, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) query.category = category;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (availability === 'in_stock') query.quantity = { $gt: 0 };
    if (availability === 'out_of_stock') query.quantity = 0;
    if (availability === 'low_stock') query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name color')
        .populate('createdBy', 'username')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      page: Number(page),
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product by QR code ID
// @route   GET /api/products/qr/:qrCodeId
// @access  Private
const getProductByQR = async (req, res, next) => {
  try {
    const product = await Product.findOne({ qrCodeId: req.params.qrCodeId, isActive: true })
      .populate('category', 'name color');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name color')
      .populate('createdBy', 'username');
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Admin
const createProduct = async (req, res, next) => {
  try {
    const product = new Product({ ...req.body, createdBy: req.user._id });
    await product.save();

    // Generate QR code with product info
    const qrData = { id: product._id, qrCodeId: product.qrCodeId, sku: product.sku };
    product.qrCode = await generateQRCode(qrData);
    await product.save();

    await product.populate('category', 'name color');
    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category', 'name color');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product components
// @route   PUT /api/products/:id/components
// @access  Private
const updateComponents = async (req, res, next) => {
  try {
    const { components } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { components },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate QR code
// @route   POST /api/products/:id/regenerate-qr
// @access  Admin
const regenerateQR = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const qrData = { id: product._id, qrCodeId: product.qrCodeId, sku: product.sku };
    product.qrCode = await generateQRCode(qrData);
    await product.save();

    res.json({ success: true, message: 'QR code regenerated', data: { qrCode: product.qrCode } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts, getProduct, getProductByQR, createProduct,
  updateProduct, deleteProduct, updateComponents, regenerateQR,
};
