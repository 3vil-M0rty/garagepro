const Unit = require('../models/Unit');
const Product = require('../models/Product');
const { generateQRCode } = require('../utils/qrGenerator');
const { v4: uuidv4 } = require('uuid');

// ── Generate serial number ────────────────────────────────────────────────
const generateSerial = async (product, categoryCode) => {
  const code = (categoryCode || 'UNT').toUpperCase().slice(0, 3);
  const productNum = String(product._id).slice(-4).toUpperCase();
  const count = await Unit.countDocuments({ product: product._id });
  const seq = String(count + 1).padStart(3, '0');
  return `${code}-${productNum}-${seq}`;
};

// ── GET ALL units (with filters) ─────────────────────────────────────────
const getUnits = async (req, res, next) => {
  try {
    const { productId, status, condition, search, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    if (productId) query.product = productId;
    if (status)    query.status = status;
    if (condition) query.condition = condition;
    if (search)    query.serialNumber = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [units, total] = await Promise.all([
      Unit.find(query)
        .populate({ path: 'product', select: 'name sku category imageUrl', populate: { path: 'category', select: 'name color' } })
        .sort('-createdAt').skip(skip).limit(Number(limit)),
      Unit.countDocuments(query),
    ]);

    res.json({ success: true, count: units.length, total, pages: Math.ceil(total / Number(limit)), page: Number(page), data: units });
  } catch (error) { next(error); }
};

// ── GET ONE unit ──────────────────────────────────────────────────────────
const getUnit = async (req, res, next) => {
  try {
    const unit = await Unit.findById(req.params.id)
      .populate({ path: 'product', select: 'name sku category price imageUrl', populate: { path: 'category', select: 'name color' } });
    if (!unit || !unit.isActive) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    res.json({ success: true, data: unit });
  } catch (error) { next(error); }
};

// ── CREATE unit(s) for a product ─────────────────────────────────────────
const createUnits = async (req, res, next) => {
  try {
    const { productId, quantity = 1, condition = 'good', purchasePrice = 0, notes } = req.body;
    const product = await Product.findById(productId).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable' });

    const categoryCode = (product.category?.name || 'UNT').slice(0, 3).toUpperCase();
    const created = [];

    for (let i = 0; i < Number(quantity); i++) {
      const serial = await generateSerial(product, categoryCode);
      const qrCodeId = uuidv4();
      const qrCode = await generateQRCode({ serial, productId: product._id, qrCodeId });

      const unit = await Unit.create({
        product: product._id,
        serialNumber: serial,
        condition,
        purchasePrice,
        notes,
        status: 'available',
        qrCodeId,
        qrCode,
      });
      created.push(unit);
    }

    res.status(201).json({ success: true, message: `${created.length} unité(s) créée(s)`, data: created });
  } catch (error) { next(error); }
};

// ── UPDATE unit ───────────────────────────────────────────────────────────
const updateUnit = async (req, res, next) => {
  try {
    const allowed = ['status', 'condition', 'purchasePrice', 'salePrice', 'notes'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    const unit = await Unit.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate({ path: 'product', select: 'name sku category imageUrl', populate: { path: 'category', select: 'name color' } });
    if (!unit) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    res.json({ success: true, message: 'Unité mise à jour', data: unit });
  } catch (error) { next(error); }
};

// ── RETIRE unit (soft delete) ─────────────────────────────────────────────
const retireUnit = async (req, res, next) => {
  try {
    const unit = await Unit.findByIdAndUpdate(req.params.id, { status: 'retired', isActive: false }, { new: true });
    if (!unit) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    res.json({ success: true, message: 'Unité réformée', data: unit });
  } catch (error) { next(error); }
};

// ── GET units by product ──────────────────────────────────────────────────
const getUnitsByProduct = async (req, res, next) => {
  try {
    const units = await Unit.find({ product: req.params.productId, isActive: true }).sort('createdAt');
    res.json({ success: true, count: units.length, data: units });
  } catch (error) { next(error); }
};

module.exports = { getUnits, getUnit, createUnits, updateUnit, retireUnit, getUnitsByProduct };
