const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const { verifyAdmin } = require('../middlewares/auth');

// Public routes
router.post('/register', adminController.register);
router.post('/login', adminController.login);

// Protected routes
// Add any admin-specific protected routes here

module.exports = router;