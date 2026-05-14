const express = require('express');
const router = express.Router();
const { getLoans, getLoan, createLoan, returnLoan } = require('../controllers/loanController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getLoans);
router.get('/:id', getLoan);
router.post('/', createLoan);
router.put('/:id/return', returnLoan);

module.exports = router;
