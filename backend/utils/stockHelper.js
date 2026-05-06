const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

/**
 * Record a stock movement and optionally update product quantity.
 * logOnly=true → only write the log, don't touch quantity (for initial stock)
 */
const recordMovement = async ({
  productId, reason, delta,
  relatedSale = null, relatedProduct = null, relatedProductName = null,
  note = null, doneBy, session = null,
  logOnly = false,
}) => {
  const product = await Product.findById(productId).session(session);
  if (!product) throw new Error(`Product ${productId} not found`);

  const quantityBefore = product.quantity;
  const quantityAfter  = logOnly
    ? quantityBefore
    : Math.max(0, quantityBefore + delta);

  if (!logOnly) {
    await Product.findByIdAndUpdate(
      productId,
      { $set: { quantity: quantityAfter } },
      { session }
    );
  }

  const movement = new StockMovement({
    product: productId,
    productName: product.name,
    productSku:  product.sku,
    reason,
    delta,
    quantityBefore,
    quantityAfter,
    relatedSale,
    relatedProduct,
    relatedProductName,
    note,
    doneBy: doneBy?._id || doneBy,
    doneByName: doneBy?.username || '',
  });
  await movement.save({ session });

  return { quantityBefore, quantityAfter };
};

/**
 * Assembly: increments quantityAssembled based on how many units actually
 * include each component (units can have different component sets).
 * Does NOT deduct from quantity — physical units are still there, just "in use".
 * quantityFree = quantity - quantityAssembled = available for new assemblies.
 */
const assembleComponents = async ({ product, userId, session }) => {
  // Build a map: linkedProductId -> total count across all units that include it
  const compCountMap = {};

  if (product.units && product.units.length > 0) {
    // Per-unit tracking: count actual inclusions per component
    for (const unit of product.units) {
      for (const uc of unit.components) {
        const linkedId = String(uc.linkedProduct || '');
        if (!linkedId) continue;
        const qty = uc.quantity || 1;
        compCountMap[linkedId] = (compCountMap[linkedId] || 0) + qty;
      }
    }
  } else {
    // No per-unit data: fall back to template × quantity
    const parentQty = product.quantity || 1;
    for (const comp of product.components) {
      if (!comp.linkedProduct) continue;
      const linkedId = String(comp.linkedProduct);
      const qty = (comp.quantity || 1) * parentQty;
      compCountMap[linkedId] = (compCountMap[linkedId] || 0) + qty;
    }
  }

  for (const [linkedId, totalQty] of Object.entries(compCountMap)) {
    const compProduct = await Product.findById(linkedId).session(session);
    if (!compProduct) continue;

    const free = compProduct.quantity - (compProduct.quantityAssembled || 0);
    if (free < totalQty) {
      throw new Error(
        `Stock insuffisant pour "${compProduct.name}" ` +
        `(libre: ${free}, requis: ${totalQty})`
      );
    }

    await Product.findByIdAndUpdate(
      linkedId,
      { $inc: { quantityAssembled: totalQty } },
      { session }
    );

    await recordMovement({
      productId: linkedId,
      reason: 'assembly',
      delta: -totalQty,
      relatedProduct: product._id,
      relatedProductName: product.name,
      note: `${totalQty} unité(s) intégrée(s) dans ${product.name}`,
      doneBy: userId,
      session,
      logOnly: true,
    });
  }
};

/**
 * Disassembly: decrements quantityAssembled based on actual unit inclusions.
 * Does NOT touch quantity itself.
 */
const disassembleComponents = async ({ product, userId, session }) => {
  // Same logic as assembly — count actual inclusions per component
  const compCountMap = {};

  if (product.units && product.units.length > 0) {
    for (const unit of product.units) {
      for (const uc of unit.components) {
        const linkedId = String(uc.linkedProduct || '');
        if (!linkedId) continue;
        compCountMap[linkedId] = (compCountMap[linkedId] || 0) + (uc.quantity || 1);
      }
    }
  } else {
    const parentQty = product.quantity || 1;
    for (const comp of product.components) {
      if (!comp.linkedProduct) continue;
      const linkedId = String(comp.linkedProduct);
      compCountMap[linkedId] = (compCountMap[linkedId] || 0) + (comp.quantity || 1) * parentQty;
    }
  }

  for (const [linkedId, totalQty] of Object.entries(compCountMap)) {
    await Product.findByIdAndUpdate(
      linkedId,
      [{ $set: {
        quantityAssembled: { $max: [0, { $subtract: ['$quantityAssembled', totalQty] }] }
      }}],
      { session }
    );

    await recordMovement({
      productId: linkedId,
      reason: 'disassembly',
      delta: totalQty,
      relatedProduct: product._id,
      relatedProductName: product.name,
      note: `${totalQty} unité(s) libérée(s) depuis ${product.name}`,
      doneBy: userId,
      session,
      logOnly: true,
    });
  }
};

module.exports = { recordMovement, assembleComponents, disassembleComponents };