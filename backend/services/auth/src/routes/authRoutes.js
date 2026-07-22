const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
  validateRegister,
  validateLogin,
  validateOTP,
  validateChangePassword,
} = require('../middleware/validation');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * PUBLIC ROUTES (No authentication required)
 */

// Register new user
router.post('/register', validateRegister, authController.register);

// Request OTP for login
router.post('/login', validateLogin, authController.requestOTP);

// Verify OTP and get JWT token
router.post('/verify-otp', validateOTP, authController.verifyOTP);

// Refresh access token from HttpOnly cookie
router.post('/refresh', authController.refreshToken);

/**
 * PROTECTED ROUTES (Authentication required)
 */

// Get current logged-in user info
router.get('/me', authMiddleware, authController.getCurrentUser);

// Logout (optional - mainly clears client-side token)
router.post('/logout', authMiddleware, authController.logout);

// Change current user password
router.post('/change-password', authMiddleware, validateChangePassword, authController.changePassword);

module.exports = router;
