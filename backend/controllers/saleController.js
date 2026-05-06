const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { recordMovement } = require('../utils/stockHelper');

const getSales = async (req, res, next) => {
  try {
    const { startDate, endDate, category, productId, page = 1, limit = 20, seller } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); query.createdAt.$lte = e; }
    }
    if (productId) query['items.product'] = productId;
    if (category)  query['items.category'] = category;
    if (seller)    query.seller = seller;
    if (req.user.role === 'staff') query.seller = req.user._id;

    const skip = (Number(page) - 1) * Number(limit);
    const [sales, total] = await Promise.all([
      Sale.find(query).populate('seller', 'username email').populate('items.product', 'name sku')
        .sort('-createdAt').skip(skip).limit(Number(limit)),
      Sale.countDocuments(query),
    ]);
    res.json({ success: true, count: sales.length, total, pages: Math.ceil(total / Number(limit)), page: Number(page), data: sales });
  } catch (error) { next(error); }
};

const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('seller', 'username email')
      .populate('items.product', 'name sku category');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (error) { next(error); }
};

const createSale = async (req, res, next) => {
  const session = await Sale.startSession();
  session.startTransaction();
  try {
    const { items, discount = 0, tax = 0, paymentMethod, notes, fromComponent } = req.body;
    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).populate('category', 'name').session(session);
      if (!product || !product.isActive) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: `Produit introuvable: ${item.product}` });
      }
      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Stock insuffisant pour "${product.name}". Disponible: ${product.quantity}` });
      }
      // Use custom unitPrice if provided, otherwise fall back to product catalogue price
      const unitPrice = (item.unitPrice != null && item.unitPrice >= 0)
        ? Number(item.unitPrice)
        : product.price;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      saleItems.push({
        product: product._id,
        productName: product.name,
        productSku: product.sku,
        category: product.category?.name || '',
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      });
      await recordMovement({
        productId: product._id,
        reason: fromComponent ? 'component_sold' : 'sale',
        delta: -item.quantity,
        relatedProduct: fromComponent ? fromComponent.parentId : null,
        relatedProductName: fromComponent ? fromComponent.parentName : null,
        note: fromComponent
          ? `Vendu séparément depuis "${fromComponent.parentName}"`
          : 'Vente',
        doneBy: req.user._id,
        session,
      });
    }

    // ── If this sale comes from a "sell component separately" action,
    //    mark the component as 'sold' in the parent (keep it in array for history),
    //    decrement quantityAssembled on the component product,
    //    and mark the unit component as sold too ──
    if (fromComponent?.parentId != null && fromComponent?.componentIdx != null) {
      const parent = await Product.findById(fromComponent.parentId).session(session);
      if (parent) {
        const compIdx = Number(fromComponent.componentIdx);
        const comp = parent.components[compIdx];

        if (comp) {
          const usedQty = comp.quantity || 1;

          // Mark component as sold (keep in array — user can add new one later)
          // Note: template components don't have a status field, so we track in units
          // Update the unit that contains this component (find first 'installed' unit with this comp)
          if (fromComponent.unitNumber != null) {
            const unitIdx = parent.units.findIndex(u => u.unitNumber === Number(fromComponent.unitNumber));
            if (unitIdx >= 0) {
              const unitCompIdx = parent.units[unitIdx].components.findIndex(
                uc => String(uc.linkedProduct) === String(comp.linkedProduct)
              );
              if (unitCompIdx >= 0) {
                parent.units[unitIdx].components[unitCompIdx].status = 'sold';
                parent.units[unitIdx].components[unitCompIdx].soldAt = new Date();
              }
            }
          }
          await parent.save({ session });

          // Decrement assembledQty on the component's stock product
          if (comp.linkedProduct) {
            await Product.findByIdAndUpdate(
              comp.linkedProduct,
              [{ $set: { quantityAssembled: { $max: [0, { $subtract: ['$quantityAssembled', usedQty] }] } } }],
              { session }
            );
          }
        }
      }
    }

    const total = subtotal - discount + tax;
    const [sale] = await Sale.create([{
      items: saleItems, subtotal, discount, tax, total,
      seller: req.user._id, sellerName: req.user.username,
      paymentMethod, notes,
    }], { session });

    await session.commitTransaction();
    await sale.populate('seller', 'username email');
    res.status(201).json({ success: true, message: 'Vente créée', data: sale });
  } catch (error) { await session.abortTransaction(); next(error); }
  finally { session.endSession(); }
};

const deleteSale = async (req, res, next) => {
  const session = await Sale.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Vente introuvable' }); }

    for (const item of sale.items) {
      await recordMovement({
        productId: item.product,
        reason: 'sale_cancel',
        delta: item.quantity,
        relatedSale: sale._id,
        note: `Annulation vente ${sale.receiptNumber}`,
        doneBy: req.user._id,
        session,
      });
    }

    await Sale.findByIdAndDelete(req.params.id).session(session);
    await session.commitTransaction();
    res.json({ success: true, message: `Vente ${sale.receiptNumber} supprimée et stock restauré` });
  } catch (error) { await session.abortTransaction(); next(error); }
  finally { session.endSession(); }
};

const getSalesStats = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days);

    const [stats, topProducts] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.productName' }, totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.totalPrice' } } },
        { $sort: { totalRevenue: -1 } }, { $limit: 5 },
      ]),
    ]);
    res.json({ success: true, data: { dailyStats: stats, topProducts, period } });
  } catch (error) { next(error); }
};

module.exports = { getSales, getSale, createSale, deleteSale, getSalesStats };