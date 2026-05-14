const express = require('express');
const router = express.Router();
const { getUnits, getUnit, createUnits, updateUnit, retireUnit, getUnitsByProduct } = require('../controllers/unitController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

router.get('/', getUnits);
router.get('/by-product/:productId', getUnitsByProduct);
router.get('/:id', getUnit);
router.post('/', createUnits);
router.put('/:id', updateUnit);
router.delete('/:id', adminOnly, retireUnit);

module.exports = router;
