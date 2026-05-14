const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.get('/', getSettings);
router.put('/', adminOnly, updateSettings);

module.exports = router;
