const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser, resetPassword, changeMyPassword } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(protect);

router.put('/me/change-password', changeMyPassword);

router.use(adminOnly);
router.route('/').get(getUsers).post(validate(schemas.registerSchema), createUser);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);
router.put('/:id/reset-password', resetPassword);

module.exports = router;
