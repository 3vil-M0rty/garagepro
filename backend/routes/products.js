const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, getProductByQR, getProductByUnitQR,
  createProduct, updateProduct, deleteProduct,
  getStockMovements, adjustStock,
  sellComponentSeparately, moveComponent, regenerateQR, getUsedIn,
  getUnits, updateUnitComponent, addUnitComponent,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(protect);

// Stock movements log
router.get('/movements', getStockMovements);

router.get('/qr/:qrCodeId', getProductByQR);
router.get('/unit-qr/:unitQrCodeId', getProductByUnitQR);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', adminOnly, validate(schemas.productSchema), createProduct);
router.put('/:id', adminOnly, validate(schemas.productSchema), updateProduct);
router.delete('/:id', adminOnly, deleteProduct);

// Stock adjust
router.post('/:id/adjust-stock', adminOnly, adjustStock);

// Component actions
router.post('/:id/component/sell', sellComponentSeparately);
router.post('/:id/component/move', moveComponent);

router.get('/:id/used-in', getUsedIn);
router.get('/:id/units', getUnits);
router.post('/:id/units/:unitNumber/components', addUnitComponent);
router.put('/:id/units/:unitNumber/components/:compIdx', updateUnitComponent);
router.post('/:id/regenerate-qr', adminOnly, regenerateQR);

module.exports = router;