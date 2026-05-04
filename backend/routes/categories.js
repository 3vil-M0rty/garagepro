const express = require('express');
const router = express.Router();
const { getCategories, getCategory, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(protect);
router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', adminOnly, validate(schemas.categorySchema), createCategory);
router.put('/:id', adminOnly, validate(schemas.categorySchema), updateCategory);
router.delete('/:id', adminOnly, deleteCategory);

module.exports = router;
