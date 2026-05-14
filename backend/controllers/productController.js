const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { generateQRCode } = require('../utils/qrGenerator');
const { recordMovement, assembleComponents, disassembleComponents } = require('../utils/stockHelper');

// ── GET ALL ───────────────────────────────────────────────────────────────
const getProducts = async (req, res, next) => {
  try {
    const {
      search, category, minPrice, maxPrice,
      availability, page = 1, limit = 20,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const query = { isActive: true };
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
    ];
    if (category)   query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (availability === 'in_stock')    query.quantity = { $gt: 0 };
    if (availability === 'out_of_stock') query.quantity = 0;
    if (availability === 'low_stock')
      query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name color parent isComponentCategory')
        .populate('createdBy', 'username')
        .populate('components.linkedProduct', 'name sku quantity quantityAssembled')
        .sort(sort).skip(skip).limit(Number(limit)),
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
  } catch (error) { next(error); }
};

// ── GET BY QR (product level) ─────────────────────────────────────────────
const getProductByQR = async (req, res, next) => {
  try {
    const product = await Product.findOne({ qrCodeId: req.params.qrCodeId, isActive: true })
      .populate('category', 'name color')
      .populate('components.linkedProduct', 'name sku quantity');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product, type: 'product' });
  } catch (error) { next(error); }
};

// ── GET BY UNIT QR ────────────────────────────────────────────────────────
// Unit QR encodes: { productId, unitNumber, qrCodeId }
const getProductByUnitQR = async (req, res, next) => {
  try {
    const { unitQrCodeId } = req.params;
    // Find the product that has a unit with this qrCodeId
    const product = await Product.findOne({
      isActive: true,
      'units.qrCodeId': unitQrCodeId,
    }).populate('category', 'name color')
      .populate('components.linkedProduct', 'name sku quantity');

    if (!product) return res.status(404).json({ success: false, message: 'Unité introuvable' });

    const unit = product.units.find(u => u.qrCodeId === unitQrCodeId);
    if (!unit) return res.status(404).json({ success: false, message: 'Unité introuvable' });

    res.json({
      success: true,
      type: 'unit',
      data: product,
      unit: {
        unitNumber:   unit.unitNumber,
        unitLabel:    unit.unitLabel,
        qrCodeId:     unit.qrCodeId,
        qrCode:       unit.qrCode,
        components:   unit.components,
        notes:        unit.notes,
      },
    });
  } catch (error) { next(error); }
};

// ── GET ONE ───────────────────────────────────────────────────────────────
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name color parent isComponentCategory')
      .populate('createdBy', 'username')
      .populate('components.linkedProduct', 'name sku quantity quantityAssembled');
    if (!product || !product.isActive)
      return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

// ── CREATE ────────────────────────────────────────────────────────────────
const createProduct = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const productData = { ...req.body, createdBy: req.user._id };

    const qty = Number(req.body.quantity) || 0;
    const compTemplate = req.body.components || [];

    // Build units — use client-provided units if present, otherwise generate
    let units = [];
    if (req.body.units && req.body.units.length > 0) {
      // Client sent pre-configured units (from the live preview table)
      units = req.body.units;
    } else if (qty > 0 && compTemplate.filter(c => c.linkedProduct).length > 0) {
      units = Array.from({ length: qty }, (_, i) => ({
        unitNumber: i + 1,
        components: compTemplate
          .filter(c => c.linkedProduct)
          .map(c => ({
            name: c.name,
            linkedProduct: c.linkedProduct,
            linkedProductName: c.name,
            quantity: c.quantity || 1,
            status: 'installed',
          })),
      }));
    }
    productData.units = units;

    const product = new Product(productData);
    await product.save({ session });

    // Assemble components (increments quantityAssembled on comp products)
    await assembleComponents({ product, userId: req.user._id, session });

    // Record initial stock movement (logOnly — quantity already set by product.save())
    if (product.quantity > 0) {
      await recordMovement({
        productId: product._id,
        reason: 'initial',
        delta: product.quantity,
        note: 'Stock initial',
        doneBy: req.user._id,
        session,
        logOnly: true,
      });
    }

    // Generate QR for the product itself
    const qrData = { id: product._id, qrCodeId: product.qrCodeId, sku: product.sku };
    product.qrCode = await generateQRCode(qrData);

    // Generate QR for each unit
    for (let i = 0; i < product.units.length; i++) {
      const unit = product.units[i];
      if (!unit.qrCodeId) {
        const { v4: uuidv4 } = require('uuid');
        unit.qrCodeId = uuidv4();
      }
      const unitQrData = {
        productId: product._id,
        unitNumber: unit.unitNumber,
        qrCodeId: unit.qrCodeId,
        sku: `${product.sku}-U${unit.unitNumber}`,
      };
      unit.qrCode = await generateQRCode(unitQrData);
    }

    await product.save({ session });

    await session.commitTransaction();
    await product.populate('category', 'name color');
    res.status(201).json({ success: true, message: 'Produit créé', data: product });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally { session.endSession(); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────
const updateProduct = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const existing = await Product.findById(req.params.id).session(session);
    if (!existing) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Snapshot old linked components BEFORE applying changes
    const oldLinkedComps = existing.components
      .filter(c => c.linkedProduct)
      .map(c => ({ id: String(c.linkedProduct?._id || c.linkedProduct), qty: c.quantity || 1 }));

    // Detect manual quantity change (separate from assembly changes)
    const qtyBefore = existing.quantity;
    const qtyAfter  = req.body.quantity !== undefined ? Number(req.body.quantity) : qtyBefore;
    const manualDelta = qtyAfter - qtyBefore;

    // Apply update fields (name, price, description, components array, etc.)
    Object.assign(existing, req.body);
    await existing.save({ session });

    // Snapshot new linked components AFTER applying changes
    const newLinkedComps = existing.components
      .filter(c => c.linkedProduct)
      .map(c => ({ id: String(c.linkedProduct?._id || c.linkedProduct), qty: c.quantity || 1 }));

    // Compute which components were REMOVED (need disassembly)
    const removed = oldLinkedComps.filter(
      old => !newLinkedComps.some(n => n.id === old.id)
    );
    // Compute which components were ADDED (need assembly)
    const added = newLinkedComps.filter(
      n => !oldLinkedComps.some(old => old.id === n.id)
    );

    // Disassemble only removed components
    for (const comp of removed) {
      const compProduct = await Product.findById(comp.id).session(session);
      if (!compProduct) continue;
      await recordMovement({
        productId: comp.id,
        reason: 'disassembly',
        delta: comp.qty,
        relatedProduct: existing._id,
        relatedProductName: existing.name,
        note: `Retiré de ${existing.name}`,
        doneBy: req.user._id,
        session,
      });
      await Product.findByIdAndUpdate(
        comp.id,
        [{ $set: { quantityAssembled: { $max: [0, { $subtract: ['$quantityAssembled', comp.qty] }] } } }],
        { session }
      );
    }

    // Assemble only newly added components
    for (const comp of added) {
      const compProduct = await Product.findById(comp.id).session(session);
      if (!compProduct) continue;
      if (compProduct.quantity < comp.qty) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour "${compProduct.name}" (disponible: ${compProduct.quantity}, requis: ${comp.qty})`,
        });
      }
      await recordMovement({
        productId: comp.id,
        reason: 'assembly',
        delta: -comp.qty,
        relatedProduct: existing._id,
        relatedProductName: existing.name,
        note: `Intégré dans ${existing.name}`,
        doneBy: req.user._id,
        session,
      });
      await Product.findByIdAndUpdate(
        comp.id,
        { $inc: { quantityAssembled: comp.qty } },
        { session }
      );
    }

    // Log manual quantity adjustment if the user changed the quantity field directly
    if (manualDelta !== 0) {
      await StockMovement.create([{
        product: existing._id,
        productName: existing.name,
        productSku:  existing.sku,
        reason: manualDelta > 0 ? 'manual_in' : 'manual_out',
        delta: manualDelta,
        quantityBefore: qtyBefore,
        quantityAfter:  qtyAfter,
        note: 'Ajustement manuel du stock',
        doneBy: req.user._id,
        doneByName: req.user.username,
      }], { session });
    }

    await session.commitTransaction();
    await existing.populate('category', 'name color');
    res.json({ success: true, message: 'Produit mis à jour', data: existing });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally { session.endSession(); }
};

// ── DELETE (soft) ─────────────────────────────────────────────────────────
const deleteProduct = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const product = await Product.findById(req.params.id).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (!product.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Produit déjà supprimé' });
    }
    // Release linked components back to stock
    await disassembleComponents({ product, userId: req.user._id, session });
    // Use findByIdAndUpdate to avoid re-running validators on the full document
    await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { session }
    );
    await session.commitTransaction();
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally { session.endSession(); }
};

// ── STOCK MOVEMENTS ───────────────────────────────────────────────────────
const getStockMovements = async (req, res, next) => {
  try {
    const { productId, reason, page = 1, limit = 30 } = req.query;
    const query = {};
    if (productId) query.product = productId;
    if (reason)    query.reason  = reason;

    const skip = (Number(page) - 1) * Number(limit);
    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .populate('product', 'name sku')
        .populate('relatedProduct', 'name sku')
        .populate('doneBy', 'username')
        .sort('-createdAt').skip(skip).limit(Number(limit)),
      StockMovement.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: movements.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      page: Number(page),
      data: movements,
    });
  } catch (error) { next(error); }
};

// ── MANUAL STOCK ADJUST ───────────────────────────────────────────────────
const adjustStock = async (req, res, next) => {
  try {
    const { delta, note } = req.body;
    if (delta === 0) return res.status(400).json({ success: false, message: 'Delta cannot be 0' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const newQty = product.quantity + delta;
    if (newQty < 0) return res.status(400).json({ success: false, message: 'Stock ne peut pas être négatif' });

    await recordMovement({
      productId: product._id,
      reason: delta > 0 ? 'manual_in' : 'manual_out',
      delta,
      note: note || (delta > 0 ? 'Entrée manuelle' : 'Sortie manuelle'),
      doneBy: req.user._id,
    });

    const updated = await Product.findById(req.params.id);
    res.json({ success: true, message: 'Stock ajusté', data: updated });
  } catch (error) { next(error); }
};

// ── COMPONENT ACTION: sell separately ─────────────────────────────────────
const sellComponentSeparately = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const { componentIdx, quantity = 1 } = req.body;
    const parent = await Product.findById(req.params.id).session(session);
    if (!parent) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Produit parent introuvable' }); }

    const comp = parent.components[componentIdx];
    if (!comp) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Composant introuvable' }); }
    if (!comp.linkedProduct) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Composant non lié à un produit stock' }); }
    // Restore from assembly, mark as sold
    await recordMovement({
      productId: comp.linkedProduct,
      reason: 'component_sold',
      delta: -(quantity),
      relatedProduct: parent._id,
      relatedProductName: parent.name,
      note: `Vendu séparément depuis ${parent.name}`,
      doneBy: req.user._id,
      session,
    });
    await Product.findByIdAndUpdate(comp.linkedProduct, { $inc: { quantityAssembled: -quantity } }, { session });

    // Remove component from parent template array so UI reflects the sale
    parent.components.splice(Number(componentIdx), 1);
    await parent.save({ session });

    await session.commitTransaction();
    res.json({ success: true, message: 'Composant vendu séparément' });
  } catch (error) { await session.abortTransaction(); next(error); }
  finally { session.endSession(); }
};

// ── COMPONENT ACTION: move to another product ─────────────────────────────
const moveComponent = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const { componentIdx, targetProductId } = req.body;
    const source = await Product.findById(req.params.id).session(session);
    const target = await Product.findById(targetProductId).session(session);
    if (!source || !target) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Produit introuvable' }); }

    const comp = source.components[componentIdx];
    if (!comp?.linkedProduct) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Composant non lié' }); }

    const qty = comp.quantity || 1;

    // Log the move
    await StockMovement.create([{
      product: comp.linkedProduct,
      productName: comp.name,
      reason: 'component_moved',
      delta: 0, // quantity doesn't change, just reassigned
      quantityBefore: 0, quantityAfter: 0,
      relatedProduct: target._id,
      relatedProductName: target.name,
      note: `Déplacé de "${source.name}" vers "${target.name}"`,
      doneBy: req.user._id,
      doneByName: req.user.username,
    }], { session });

    // Remove from source, add to target
    source.components.splice(componentIdx, 1);
    await source.save({ session });

    target.components.push({ ...comp.toObject(), _id: undefined });
    await target.save({ session });

    await session.commitTransaction();
    res.json({ success: true, message: `Composant déplacé vers ${target.name}` });
  } catch (error) { await session.abortTransaction(); next(error); }
  finally { session.endSession(); }
};

// ── REGENERATE QR ─────────────────────────────────────────────────────────
const regenerateQR = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const qrData = { id: product._id, qrCodeId: product.qrCodeId, sku: product.sku };
    product.qrCode = await generateQRCode(qrData);
    await product.save();
    res.json({ success: true, message: 'QR code régénéré', data: { qrCode: product.qrCode } });
  } catch (error) { next(error); }
};

module.exports = {
  getProducts, getProduct, getProductByQR, getProductByUnitQR,
  createProduct, updateProduct, deleteProduct,
  getStockMovements, adjustStock,
  sellComponentSeparately, moveComponent, regenerateQR,
};

// @desc    Get parent products + their units that have this product as a linked component
// @route   GET /api/products/:id/used-in
// @access  Private
const getUsedIn = async (req, res, next) => {
  try {
    const parents = await Product.find({
      isActive: true,
      'components.linkedProduct': req.params.id,
    })
      .populate('category', 'name color')
      .select('name sku category components quantity quantityAssembled units');

    // Build a flat list: one entry per unit that contains this component
    const result = [];

    for (const parent of parents) {
      const componentIdx = parent.components.findIndex(
        c => String(c.linkedProduct) === String(req.params.id)
      );
      const comp = componentIdx >= 0 ? parent.components[componentIdx] : null;

      if (parent.units && parent.units.length > 0) {
        // Per-unit tracking: show one card per unit that has this component installed
        for (const unit of parent.units) {
          const unitComp = unit.components.find(
            uc => uc.linkedProduct && String(uc.linkedProduct) === String(req.params.id)
          );
          if (!unitComp) continue; // this unit doesn't have the component

          result.push({
            _id:          parent._id,
            name:         parent.name,
            sku:          parent.sku,
            category:     parent.category,
            // Unit-specific data
            unitNumber:   unit.unitNumber,
            unitLabel:    unit.unitLabel,
            unitQrCode:   unit.qrCode || null,   // unit's own QR
            unitQrCodeId: unit.qrCodeId || null,
            unitCompStatus: unitComp.status || 'installed',
            componentIdx,
            componentQty: unitComp.quantity || comp?.quantity || 1,
            componentName: unitComp.name || comp?.name,
            canSellSeparately: comp?.canSellSeparately || false,
            canMove:           comp?.canMove !== false,
          });
        }
      } else {
        // No per-unit tracking: fall back to one card per parent quantity
        const qty = parent.quantity || 1;
        for (let i = 1; i <= qty; i++) {
          result.push({
            _id:          parent._id,
            name:         parent.name,
            sku:          parent.sku,
            category:     parent.category,
            unitNumber:   i,
            unitQrCode:   null, // no per-unit QR yet
            unitQrCodeId: null,
            unitCompStatus: 'installed',
            componentIdx,
            componentQty: comp?.quantity || 1,
            componentName: comp?.name,
            canSellSeparately: comp?.canSellSeparately || false,
            canMove:           comp?.canMove !== false,
          });
        }
      }
    }

    res.json({ success: true, count: result.length, data: result });
  } catch (error) { next(error); }
};

// Re-export with new function
module.exports = {
  getProducts, getProduct, getProductByQR, getProductByUnitQR,
  createProduct, updateProduct, deleteProduct,
  getStockMovements, adjustStock,
  sellComponentSeparately, moveComponent, regenerateQR,
  getUsedIn,
};

// ── GET UNITS for a product ───────────────────────────────────────────────
// @route GET /api/products/:id/units
const getUnits = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    // Manually populate only non-null linkedProduct refs to avoid null._id crash
    const units = product.units.map(unit => ({
      ...unit.toObject(),
      components: unit.components.map(comp => ({
        ...comp.toObject(),
        linkedProduct: comp.linkedProduct || null,
      })),
    }));
    res.json({ success: true, data: units });
  } catch (error) { next(error); }
};

// ── UPDATE a unit's component status ─────────────────────────────────────
// @route PUT /api/products/:id/units/:unitNumber/components/:compIdx
const updateUnitComponent = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const unit = product.units.find(u => u.unitNumber === Number(req.params.unitNumber));
    if (!unit) return res.status(404).json({ success: false, message: 'Unité introuvable' });

    const comp = unit.components[Number(req.params.compIdx)];
    if (!comp) return res.status(404).json({ success: false, message: 'Composant introuvable' });

    if (status) comp.status = status;
    if (notes !== undefined) unit.notes = notes;

    await product.save();
    res.json({ success: true, message: 'Composant mis à jour', data: unit });
  } catch (error) { next(error); }
};

// ── ADD a component to a specific unit (replace sold/missing) ─────────────
// @route POST /api/products/:id/units/:unitNumber/components
const addUnitComponent = async (req, res, next) => {
  const session = await Product.startSession();
  session.startTransaction();
  try {
    const { linkedProductId, name, quantity = 1 } = req.body;
    const product = await Product.findById(req.params.id).session(session);
    if (!product) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Product not found' }); }

    const unit = product.units.find(u => u.unitNumber === Number(req.params.unitNumber));
    if (!unit) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Unité introuvable' }); }

    if (linkedProductId) {
      const compProduct = await Product.findById(linkedProductId).session(session);
      if (!compProduct) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Produit composant introuvable' }); }

      const free = compProduct.quantity - (compProduct.quantityAssembled || 0);
      if (free < quantity) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Stock insuffisant pour "${compProduct.name}" (libre: ${free}, requis: ${quantity})` });
      }

      unit.components.push({
        name: name || compProduct.name,
        linkedProduct: linkedProductId,
        linkedProductName: compProduct.name,
        quantity,
        status: 'installed',
      });

      // Deduct from component stock
      await recordMovement({
        productId: linkedProductId,
        reason: 'assembly',
        delta: -quantity,
        relatedProduct: product._id,
        relatedProductName: product.name,
        note: `Installé dans ${product.name} unité #${req.params.unitNumber}`,
        doneBy: req.user._id,
        session,
      });
      await Product.findByIdAndUpdate(linkedProductId, { $inc: { quantityAssembled: quantity } }, { session });
    } else {
      unit.components.push({ name, quantity, status: 'installed' });
    }

    await product.save({ session });
    await session.commitTransaction();
    res.json({ success: true, message: 'Composant ajouté à l\'unité', data: unit });
  } catch (error) { await session.abortTransaction(); next(error); }
  finally { session.endSession(); }
};

module.exports = {
  getProducts, getProduct, getProductByQR, getProductByUnitQR,
  createProduct, updateProduct, deleteProduct,
  getStockMovements, adjustStock,
  sellComponentSeparately, moveComponent, regenerateQR,
  getUsedIn, getUnits, updateUnitComponent, addUnitComponent,
};