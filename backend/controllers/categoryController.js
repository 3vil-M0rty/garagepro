const Category = require('../models/Category');
const Product  = require('../models/Product');

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({})
      .populate('createdBy', 'username')
      .populate('parent', 'name color')
      .sort('name');
    res.json({ success: true, count: categories.length, data: categories });
  } catch (error) { next(error); }
};

const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('parent', 'name color');
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (error) { next(error); }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await Category.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'Catégorie créée', data: category });
  } catch (error) { next(error); }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Catégorie mise à jour', data: category });
  } catch (error) { next(error); }
};

const deleteCategory = async (req, res, next) => {
  try {
    const [productCount, subCount] = await Promise.all([
      Product.countDocuments({ category: req.params.id, isActive: true }),
      Category.countDocuments({ parent: req.params.id }),
    ]);
    if (productCount > 0)
      return res.status(400).json({ success: false, message: `Impossible : ${productCount} produit(s) utilisent cette catégorie` });
    if (subCount > 0)
      return res.status(400).json({ success: false, message: `Impossible : ${subCount} sous-catégorie(s) dépendent de cette catégorie` });

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (error) { next(error); }
};

// Get subcategories of a category
const getSubcategories = async (req, res, next) => {
  try {
    const subs = await Category.find({ parent: req.params.id }).populate('createdBy', 'username');
    res.json({ success: true, data: subs });
  } catch (error) { next(error); }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory, getSubcategories };
