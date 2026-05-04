const Product = require('../models/Product');
const Sale = require('../models/Sale');
const User = require('../models/User');
const Category = require('../models/Category');

// @desc    Get dashboard KPIs
// @route   GET /api/dashboard
// @access  Admin
const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalCategories,
      totalUsers,
      todaySales,
      monthSales,
      yearSales,
      recentSales,
      lowStockList,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockThreshold'] }] } }),
      Product.countDocuments({ isActive: true, quantity: 0 }),
      Category.countDocuments(),
      User.countDocuments({ isActive: true }),
      Sale.aggregate([{ $match: { createdAt: { $gte: startOfDay } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Sale.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Sale.aggregate([{ $match: { createdAt: { $gte: startOfYear } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Sale.find().sort('-createdAt').limit(5).populate('seller', 'username'),
      Product.find({ isActive: true, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } })
        .populate('category', 'name color').sort('quantity').limit(10),
    ]);

    const inventoryValue = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$quantity'] } } } },
    ]);

    res.json({
      success: true,
      data: {
        inventory: {
          total: totalProducts,
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
          categories: totalCategories,
          users: totalUsers,
          value: inventoryValue[0]?.total || 0,
        },
        sales: {
          today: { revenue: todaySales[0]?.total || 0, count: todaySales[0]?.count || 0 },
          month: { revenue: monthSales[0]?.total || 0, count: monthSales[0]?.count || 0 },
          year: { revenue: yearSales[0]?.total || 0, count: yearSales[0]?.count || 0 },
        },
        recentSales,
        lowStockList,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
