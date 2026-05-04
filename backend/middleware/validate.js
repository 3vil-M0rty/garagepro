const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message).join('. ');
    return res.status(400).json({ success: false, message: messages });
  }
  next();
};

// Auth schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'staff').default('staff'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Category schema
const categorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(200).allow('', null),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default("#6366f1"),
  defaultComponents: Joi.array().items(Joi.object({ name: Joi.string().required() })).default([]),
});

// Product schema
const productSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  category: Joi.string().required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(0).default(0),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  description: Joi.string().max(500).allow('', null),
  components: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    checked: Joi.boolean().default(false),
  })).default([]),
});

// Sale schema
const saleSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    product: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
  })).min(1).required(),
  discount: Joi.number().min(0).default(0),
  tax: Joi.number().min(0).default(0),
  paymentMethod: Joi.string().valid('cash', 'card', 'transfer', 'other').default('cash'),
  notes: Joi.string().max(300).allow('', null),
});

module.exports = {
  validate,
  schemas: { registerSchema, loginSchema, categorySchema, productSchema, saleSchema },
};
