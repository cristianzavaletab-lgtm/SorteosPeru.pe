const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewards.controller');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', rewardsController.getRewardsZone);
router.post('/ruleta/girar', rewardsController.spinWheel);
router.post('/cofre/abrir', rewardsController.openMysteryChest);
router.post('/caja/abrir', rewardsController.openMysteryBox);
router.post('/raspa/ganar', rewardsController.scratchCard);
router.post('/carta/elegir', rewardsController.pickCard);
router.post('/doble-o-nada/jugar', rewardsController.playDoubleOrNothing);
router.post('/doble-o-nada/cobrar', rewardsController.collectDoubleOrNothing);
router.post('/tienda/comprar', rewardsController.exchangeCredits);

module.exports = router;
