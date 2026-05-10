const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { protect } = require('../middlewares/authMiddleware');

router.post('/subscribe', protect, pushController.subscribe);
router.post('/unsubscribe', protect, pushController.unsubscribe);

module.exports = router;
