const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: { objects: true },
  });
  if (error) {
    const messages = error.details.map(d => d.message).join('. ');
    return res.status(400).json({ success: false, message: messages });
  }
  req.body = value;
  next();
};

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

const categorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(200).allow('', null),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#6366f1'),
  parent: Joi.string().allow('', null).default(null),
  isComponentCategory: Joi.boolean().default(false),
  defaultComponents: Joi.array().items(
    Joi.object({ name: Joi.string().required() }).options({ stripUnknown: true })
  ).default([]),
});

const productSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  category: Joi.string().required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(0).default(0),
  quantityAssembled: Joi.number().integer().min(0).default(0),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  description: Joi.string().max(500).allow('', null),
  components: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      checked: Joi.boolean().default(false),
      linkedProduct: Joi.string().allow('', null).default(null),
      quantity: Joi.number().integer().min(1).default(1),
      canSellSeparately: Joi.boolean().default(false),
      canMove: Joi.boolean().default(true),
    }).options({ stripUnknown: true })
  ).default([]),
  // Client-provided pre-configured units (from live preview table in form)
  units: Joi.array().items(
    Joi.object({
      unitNumber: Joi.number().integer().min(1).required(),
      unitLabel: Joi.string().allow('', null),
      qrCodeId: Joi.string().allow('', null),
      components: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          linkedProduct: Joi.string().allow('', null).default(null),
          linkedProductName: Joi.string().allow('', null),
          quantity: Joi.number().integer().min(1).default(1),
          status: Joi.string().valid('installed','sold','moved','missing').default('installed'),
        }).options({ stripUnknown: true })
      ).default([]),
    }).options({ stripUnknown: true })
  ).default([]),
});

const saleSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    product: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    unitPrice: Joi.number().min(0).allow(null), // optional override — falls back to product price
  })).min(1).required(),
  discount: Joi.number().min(0).default(0),
  tax: Joi.number().min(0).default(0),
  paymentMethod: Joi.string().valid('cash', 'card', 'transfer', 'other').default('cash'),
  notes: Joi.string().max(300).allow('', null),
  // Optional: when selling a component separately, remove it from parent
  fromComponent: Joi.object({
    parentId:     Joi.string().required(),
    componentIdx: Joi.number().integer().min(0).required(),
    parentName:   Joi.string().allow('', null),
    componentName: Joi.string().allow('', null),
  }).allow(null).default(null),
});

module.exports = {
  validate,
  schemas: { registerSchema, loginSchema, categorySchema, productSchema, saleSchema },
};