const Loan = require('../models/Loan');
const Unit = require('../models/Unit');
const Product = require('../models/Product');

// ── GET ALL loans ─────────────────────────────────────────────────────────
const getLoans = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    // Auto-mark overdue
    await Loan.updateMany(
      { status: 'active', expectedReturnAt: { $lt: new Date() } },
      { $set: { status: 'overdue' } }
    );

    const skip = (Number(page) - 1) * Number(limit);
    const [loans, total] = await Promise.all([
      Loan.find(query)
        .populate({ path: 'unit', select: 'serialNumber product status condition', populate: { path: 'product', select: 'name sku imageUrl' } })
        .populate('createdBy', 'username')
        .sort('-lentAt').skip(skip).limit(Number(limit)),
      Loan.countDocuments(query),
    ]);

    res.json({ success: true, count: loans.length, total, pages: Math.ceil(total / Number(limit)), page: Number(page), data: loans });
  } catch (error) { next(error); }
};

// ── GET ONE loan ──────────────────────────────────────────────────────────
const getLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate({ path: 'unit', select: 'serialNumber product status condition', populate: { path: 'product', select: 'name sku category', populate: { path: 'category', select: 'name' } } })
      .populate('createdBy', 'username');
    if (!loan) return res.status(404).json({ success: false, message: 'Emprunt introuvable' });
    res.json({ success: true, data: loan });
  } catch (error) { next(error); }
};

// ── CREATE loan ───────────────────────────────────────────────────────────
const createLoan = async (req, res, next) => {
  try {
    const { unitId, borrowerName, borrowerPhone, borrowerType, expectedReturnAt, depositAmount, notes } = req.body;

    const unit = await Unit.findById(unitId).populate('product', 'name sku');
    if (!unit) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    if (unit.status !== 'available') return res.status(400).json({ success: false, message: `Unité non disponible (statut: ${unit.status})` });

    // Mark unit as lent
    unit.status = 'lent';
    await unit.save();

    const loan = await Loan.create({
      unit: unit._id,
      unitSerial:  unit.serialNumber,
      productName: unit.product?.name || '',
      borrowerName,
      borrowerPhone,
      borrowerType: borrowerType || 'client',
      lentAt: new Date(),
      expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
      depositAmount: depositAmount || 0,
      notes,
      status: 'active',
      createdBy: req.user._id,
    });

    await loan.populate([
      { path: 'unit', select: 'serialNumber product status condition', populate: { path: 'product', select: 'name sku' } },
      { path: 'createdBy', select: 'username' },
    ]);

    res.status(201).json({ success: true, message: 'Emprunt créé', data: loan });
  } catch (error) { next(error); }
};

// ── RETURN loan ───────────────────────────────────────────────────────────
const returnLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('unit');
    if (!loan) return res.status(404).json({ success: false, message: 'Emprunt introuvable' });
    if (loan.status === 'returned') return res.status(400).json({ success: false, message: 'Emprunt déjà retourné' });

    loan.status = 'returned';
    loan.returnedAt = new Date();
    await loan.save();

    // Mark unit as available again
    if (loan.unit) {
      await Unit.findByIdAndUpdate(loan.unit._id, { status: 'available' });
    }

    res.json({ success: true, message: 'Retour enregistré', data: loan });
  } catch (error) { next(error); }
};

module.exports = { getLoans, getLoan, createLoan, returnLoan };
