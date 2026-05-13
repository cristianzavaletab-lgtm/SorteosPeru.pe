const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const Winner = require('../models/Winner');
const Raffle = require('../models/Raffle');
const Notification = require('../models/Notification');

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
router.get('/register', (req, res) => res.render('register', { error: req.query.error, phone: req.query.phone }));

// Rutas públicas para clientes invitados
router.get('/mis-tickets', (req, res) => {
  res.render('check-tickets', { tickets: null, phone: null, error: null });
});

router.post('/mis-tickets', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.render('check-tickets', { tickets: null, phone: null, error: 'Por favor, ingresa tu número de celular.' });
    }

    // Buscar tickets válidos donde guestPhone sea el celular
    // También buscar usuarios con ese teléfono
    const User = require('../models/User');
    const userWithPhone = await User.findOne({ phone });

    const searchCriteria = { status: { $in: ['valid', 'winner'] } };
    if (userWithPhone) {
      searchCriteria.$or = [
        { guestPhone: phone },
        { userId: userWithPhone._id }
      ];
    } else {
      searchCriteria.guestPhone = phone;
    }

    const tickets = await Ticket.find(searchCriteria).populate('raffleId').sort({ createdAt: -1 });

    res.render('check-tickets', { tickets, phone, error: null });
  } catch (error) {
    console.error(error);
    res.render('check-tickets', { tickets: null, phone: null, error: 'Hubo un error al buscar tus tickets. Intenta nuevamente.' });
  }
});

// --- Notificaciones ---
router.get('/notifications', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? { role: 'admin' } 
      : { recipientId: req.user._id };
      
    const notifications = await Notification.find(query).sort('-createdAt').limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

router.post('/notifications/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});

module.exports = router;
