const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/:id', protect, paymentController.getPaymentPage);
router.post('/:id/subir-comprobante', protect, upload.single('receipt'), paymentController.submitPayment);

module.exports = router;
