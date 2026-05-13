const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { protect, isVendor } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware'); // Assuming this exists

// Vendor Dashboard
router.get('/dashboard', protect, isVendor, vendorController.getDashboard);

// Register Sale View
router.get('/register-sale', protect, isVendor, vendorController.renderRegisterSale);

// Register Sale Action (Handles file upload 'receiptImage')
router.post('/register-sale', protect, isVendor, upload.single('receiptImage'), vendorController.registerSale);

module.exports = router;
