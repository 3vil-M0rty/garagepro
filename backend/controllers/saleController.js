const Sale = require('../models/Sale');
const Product = require('../models/Product');

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res, next) => {
  try {
    const {
      startDate, endDate, category, productId,
      page = 1, limit = 20, seller,
    } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (productId) query['items.product'] = productId;
    if (category) query['items.category'] = category;
    if (seller) query.seller = seller;

    // Staff can only see their own sales
    if (req.user.role === 'staff') {
      query.seller = req.user._id;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('seller', 'username email')
        .populate('items.product', 'name sku')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Sale.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: sales.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      page: Number(page),
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('seller', 'username email')
      .populate('items.product', 'name sku category');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

// @desc    Create sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res, next) => {
  const session = await Sale.startSession();
  session.startTransaction();
  try {
    const { items, discount = 0, tax = 0, paymentMethod, notes } = req.body;

    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).populate('category', 'name').session(session);
      if (!product || !product.isActive) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      }
      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.quantity}`,
        });
      }

      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;

      saleItems.push({
        product: product._id,
        productName: product.name,
        productSku: product.sku,
        category: product.category?.name || '',
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: lineTotal,
      });

      // Reduce stock
      await Product.findByIdAndUpdate(
        product._id,
        { $inc: { quantity: -item.quantity } },
        { session }
      );
    }

    const total = subtotal - discount + tax;

    const [sale] = await Sale.create([{
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      seller: req.user._id,
      sellerName: req.user.username,
      paymentMethod,
      notes,
    }], { session });

    await session.commitTransaction();

    await sale.populate('seller', 'username email');
    res.status(201).json({ success: true, message: 'Sale created', data: sale });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get sales stats
// @route   GET /api/sales/stats
// @access  Admin
const getSalesStats = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topProducts = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
    ]);

    res.json({ success: true, data: { dailyStats: stats, topProducts, period } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSales, getSale, createSale, getSalesStats };
