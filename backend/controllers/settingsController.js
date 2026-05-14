const Setting = require('../models/Setting');

const DEFAULT_SETTINGS = [
  { key: 'garage_name',    value: 'GaragePro' },
  { key: 'garage_address', value: '' },
  { key: 'garage_phone',   value: '' },
  { key: 'garage_logo_url', value: '' },
  { key: 'garage_ice',     value: '' },
  { key: 'garage_rc',      value: '' },
  { key: 'default_language', value: 'fr' },
  { key: 'quote_validity_days', value: '30' },
];

// ── GET ALL settings ──────────────────────────────────────────────────────
const getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find({});
    // Merge with defaults so all keys always exist
    const map = {};
    for (const s of settings) map[s.key] = s.value;
    for (const d of DEFAULT_SETTINGS) {
      if (!(d.key in map)) map[d.key] = d.value;
    }
    res.json({ success: true, data: map });
  } catch (error) { next(error); }
};

// ── UPDATE settings (bulk) ────────────────────────────────────────────────
const updateSettings = async (req, res, next) => {
  try {
    const updates = req.body; // { garage_name: 'X', garage_phone: '...' }
    const ops = Object.entries(updates).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { key, value: String(value) } },
        upsert: true,
      },
    }));
    if (ops.length > 0) await Setting.bulkWrite(ops);
    res.json({ success: true, message: 'Paramètres enregistrés' });
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings };
