const express = require('express');
const router = express.Router();
const businessController = require('../controllers/business.controller');
const { protect } = require('../middlewares/authMiddleware');

// Public routes
router.get('/negocios', businessController.getPublicBusinesses);

// User routes (requires login)
router.get('/canjear', protect, businessController.getRedeemPage);
router.post('/canjear', protect, businessController.redeemCode);

module.exports = router;
