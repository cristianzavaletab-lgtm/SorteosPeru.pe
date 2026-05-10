const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { protect, admin } = require('../middlewares/authMiddleware');

router.post('/subscribe', protect, pushController.subscribe);
router.post('/unsubscribe', protect, pushController.unsubscribe);
router.post('/test', protect, pushController.testPush);
router.post('/broadcast', protect, admin, pushController.broadcastPush);

module.exports = router;
