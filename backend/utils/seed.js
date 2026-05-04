require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { generateQRCode } = require('./qrGenerator');
const connectDB = require('../config/database');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  await User.deleteMany({});
  await Category.deleteMany({});
  await Product.deleteMany({});

  // Users
  const admin = await User.create({
    username: 'admin',
    email: 'admin@garage.com',
    password: 'admin123',
    role: 'admin',
  });
  await User.create({
    username: 'staff1',
    email: 'staff@garage.com',
    password: 'staff123',
    role: 'staff',
  });
  console.log('✅ Users created');

  // Categories — each with defaultComponents
  const categoriesData = [
    {
      name: 'Moteurs',
      description: 'Moteurs et pièces principales',
      color: '#ef4444',
      defaultComponents: [
        { name: 'Piston' },
        { name: 'Soupape' },
        { name: 'Cylindre' },
        { name: 'Vilebrequin' },
        { name: 'Culasse' },
        { name: 'Joint de culasse' },
        { name: 'Carter moteur' },
      ],
      createdBy: admin._id,
    },
    {
      name: 'Freinage',
      description: 'Systèmes de freinage',
      color: '#f97316',
      defaultComponents: [
        { name: 'Disque de frein' },
        { name: 'Étrier de frein' },
        { name: 'Plaquettes de frein' },
        { name: 'Maître-cylindre' },
        { name: 'Flexible de frein' },
      ],
      createdBy: admin._id,
    },
    {
      name: 'Suspension',
      description: 'Amortisseurs et ressorts',
      color: '#eab308',
      defaultComponents: [
        { name: 'Corps amortisseur' },
        { name: 'Ressort hélicoïdal' },
        { name: 'Cache-poussière' },
        { name: 'Butée de suspension' },
        { name: 'Silent bloc' },
      ],
      createdBy: admin._id,
    },
    {
      name: 'Électrique',
      description: 'Composants électriques',
      color: '#22c55e',
      defaultComponents: [
        { name: 'Stator' },
        { name: 'Rotor' },
        { name: 'Régulateur de tension' },
        { name: 'Pont de diodes' },
        { name: 'Roulement' },
      ],
      createdBy: admin._id,
    },
    {
      name: 'Filtres',
      description: 'Filtres air, huile, carburant',
      color: '#3b82f6',
      defaultComponents: [],
      createdBy: admin._id,
    },
    {
      name: 'Carrosserie',
      description: 'Pièces de carrosserie',
      color: '#8b5cf6',
      defaultComponents: [
        { name: 'Coque externe' },
        { name: 'Supports de fixation' },
        { name: 'Grille de ventilation' },
        { name: 'Clips de fixation' },
      ],
      createdBy: admin._id,
    },
    {
      name: 'Transmission',
      description: 'Boîte de vitesses et embrayage',
      color: '#14b8a6',
      defaultComponents: [
        { name: 'Disque embrayage' },
        { name: 'Plateau de pression' },
        { name: 'Butée de débrayage' },
        { name: 'Volant moteur' },
        { name: 'Arbre de transmission' },
      ],
      createdBy: admin._id,
    },
  ];

  const categories = await Category.insertMany(categoriesData);
  console.log('✅ Categories created (with defaultComponents)');

  // Products
  const productsData = [
    {
      name: 'Moteur V6 3.0L',
      category: categories[0]._id,
      price: 45000,
      quantity: 3,
      lowStockThreshold: 2,
      description: 'Moteur V6 essence haute performance',
      components: categories[0].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Moteur Diesel 2.0L HDi',
      category: categories[0]._id,
      price: 38000,
      quantity: 2,
      lowStockThreshold: 2,
      description: 'Moteur diesel common rail',
      components: categories[0].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Kit freinage avant',
      category: categories[1]._id,
      price: 1200,
      quantity: 15,
      lowStockThreshold: 5,
      description: 'Kit complet freinage avant',
      components: categories[1].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Amortisseur arrière',
      category: categories[2]._id,
      price: 850,
      quantity: 8,
      lowStockThreshold: 3,
      description: 'Amortisseur hydraulique universel',
      components: categories[2].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Alternateur 120A',
      category: categories[3]._id,
      price: 2200,
      quantity: 5,
      lowStockThreshold: 2,
      description: 'Alternateur haute capacité',
      components: categories[3].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Filtre à huile',
      category: categories[4]._id,
      price: 45,
      quantity: 150,
      lowStockThreshold: 20,
      description: 'Filtre à huile moteur standard',
      components: [],
      createdBy: admin._id,
    },
    {
      name: 'Filtre à air',
      category: categories[4]._id,
      price: 65,
      quantity: 4,
      lowStockThreshold: 10,
      description: 'Filtre à air haute filtration',
      components: [],
      createdBy: admin._id,
    },
    {
      name: 'Pare-choc avant',
      category: categories[5]._id,
      price: 3500,
      quantity: 0,
      lowStockThreshold: 2,
      description: 'Pare-choc avant universel ABS',
      components: categories[5].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
    {
      name: 'Kit embrayage complet',
      category: categories[6]._id,
      price: 2800,
      quantity: 6,
      lowStockThreshold: 2,
      description: 'Kit embrayage avec volant moteur',
      components: categories[6].defaultComponents.map(c => ({ name: c.name, checked: false })),
      createdBy: admin._id,
    },
  ];

  for (const pData of productsData) {
    const product = new Product(pData);
    await product.save();
    const qrData = { id: product._id, qrCodeId: product.qrCodeId, sku: product.sku };
    product.qrCode = await generateQRCode(qrData);
    await product.save();
  }

  console.log('✅ Products created (9 products with QR codes)');
  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Admin : admin@garage.com / admin123');
  console.log('📧 Staff : staff@garage.com  / staff123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
