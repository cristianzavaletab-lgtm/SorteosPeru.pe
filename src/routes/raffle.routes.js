const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/raffle.controller');

router.get('/', raffleController.getHome);
router.get('/sorteos', raffleController.getRaffles);
router.get('/sorteos/:id', raffleController.getRaffleDetail);

module.exports = router;
