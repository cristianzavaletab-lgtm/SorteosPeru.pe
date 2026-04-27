const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, admin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect, admin);

router.get('/', adminController.getDashboard);
router.get('/pagos', adminController.getPayments);
router.post('/pagos/:id/aprobar', adminController.approvePayment);
router.post('/pagos/:id/rechazar', adminController.rejectPayment);
router.get('/sorteos', adminController.getRaffles);
router.post('/sorteos', upload.single('image'), adminController.createRaffle);
router.post('/sorteos/:id/editar', upload.single('image'), adminController.updateRaffle);
router.post('/sorteos/:id/eliminar', adminController.deleteRaffle);
router.get('/sorteos/:id/ejecutar', adminController.getDrawPage);
router.post('/sorteos/:id/ejecutar', adminController.executeDraw);
router.get('/ganadores', adminController.getWinners);
router.get('/ganadores/:id', adminController.getWinner);
router.post('/ganadores/:id/entregar', adminController.deliverPrize);

// Usuarios
router.get('/usuarios', adminController.getUsers);
router.post('/usuarios/:id/regalar-tickets', adminController.giftTickets);
router.get('/usuarios/exportar', adminController.exportData);

module.exports = router;
