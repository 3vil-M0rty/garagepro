const express = require('express');
const router = express.Router();
const { getSales, getSale, createSale, getSalesStats } = require('../controllers/saleController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(protect);
router.get('/stats', adminOnly, getSalesStats);
router.get('/', getSales);
router.post('/', validate(schemas.saleSchema), createSale);
router.get('/:id', getSale);

module.exports = router;
