const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, getProductByQR, createProduct,
  updateProduct, deleteProduct, updateComponents, regenerateQR,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(protect);
router.get('/', getProducts);
router.get('/qr/:qrCodeId', getProductByQR);
router.get('/:id', getProduct);
router.post('/', adminOnly, validate(schemas.productSchema), createProduct);
router.put('/:id', adminOnly, validate(schemas.productSchema), updateProduct);
router.delete('/:id', adminOnly, deleteProduct);
router.put('/:id/components', updateComponents);
router.post('/:id/regenerate-qr', adminOnly, regenerateQR);

module.exports = router;
