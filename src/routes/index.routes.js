const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const Winner = require('../models/Winner');
const Raffle = require('../models/Raffle');

router.get('/dashboard', protect, async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id }).populate('raffleId');
    const payments = await Payment.find({ userId: req.user._id }).populate('raffleId');
    const wins = await Winner.find({ userId: req.user._id }).populate('raffleId');
    
    // Obtener últimos ganadores globales para dar confianza
    const recentWinners = await Winner.find({}).populate('userId').populate('raffleId').populate('ticketId').sort({ createdAt: -1 }).limit(3);
    
    // Buscar el próximo sorteo activo
    const nextRaffle = await Raffle.findOne({ status: 'active' }).sort({ drawDate: 1 });
    
    res.render('dashboard', { tickets, payments, wins, nextRaffle, recentWinners });
  } catch (error) {
    res.status(500).send('Error en el dashboard');
  }
});

router.get('/login', (req, res) => res.render('login', { error: req.query.error }));
router.get('/register', (req, res) => res.render('register', { error: req.query.error }));

module.exports = router;
