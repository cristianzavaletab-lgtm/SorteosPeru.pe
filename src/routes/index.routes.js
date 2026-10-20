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
    const wins = await Winner.find({ userId: req.user._id }).populate('raffleId').populate('ticketId');
    
    // Obtener últimos ganadores globales para dar confianza
    const recentWinners = await Winner.find({}).populate('userId').populate('raffleId').populate('ticketId').sort({ createdAt: -1 }).limit(3);
    
    // Buscar el próximo sorteo activo
    const nextRaffle = await Raffle.findOne({ status: 'active' }).sort({ drawDate: 1 });
    
    res.render('dashboard', { tickets, payments, wins, nextRaffle, recentWinners, query: req.query });
  } catch (error) {
    res.status(500).send('Error en el dashboard');
  }
});

// =============================================
// MÓDULO DE PERFIL DE USUARIO (/perfil)
// =============================================
router.get('/perfil', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const userDoc = await User.findById(req.user._id);

    const totalTickets = await Ticket.countDocuments({ userId: req.user._id });
    const activeTickets = await Ticket.countDocuments({ 
      userId: req.user._id, 
      status: { $in: ['valid', 'winner'] } 
    });
    const totalWins = await Winner.countDocuments({ 
      userId: req.user._id, 
      deliveryStatus: { $ne: 'disqualified' } 
    });
    const recentTickets = await Ticket.find({ userId: req.user._id })
      .populate('raffleId')
      .sort({ createdAt: -1 })
      .limit(6);

    res.render('profile', {
      user: userDoc,
      totalTickets,
      activeTickets,
      totalWins,
      recentTickets,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Error al cargar tu perfil.'));
  }
});

// Actualizar número de celular / WhatsApp del perfil
router.post('/perfil/telefono', protect, async (req, res) => {
  const returnTo = req.body.returnUrl || (req.headers.referer && req.headers.referer.includes('/perfil') ? '/perfil' : '/dashboard');
  try {
    const { phone } = req.body;
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!/^[0-9]{9}$/.test(cleanPhone)) {
      return res.redirect(`${returnTo}?error=` + encodeURIComponent('El número de WhatsApp debe tener exactamente 9 dígitos.'));
    }

    const User = require('../models/User');
    const existingCount = await User.countDocuments({ phone: cleanPhone, _id: { $ne: req.user._id } });
    if (existingCount >= 2) {
      return res.redirect(`${returnTo}?error=` + encodeURIComponent('Este número de celular ya alcanzó el límite máximo de cuentas asociadas.'));
    }

    const user = await User.findById(req.user._id);
    user.phone = cleanPhone;
    await user.save();

    res.redirect(`${returnTo}?success=` + encodeURIComponent('¡Tu número de WhatsApp se actualizó con éxito! Ahora recibirás tus confirmaciones de tickets y llamadas en vivo cuando ganes.'));
  } catch (error) {
    console.error('Error al actualizar teléfono:', error);
    res.redirect(`${returnTo}?error=` + encodeURIComponent('Error al actualizar el número de celular.'));
  }
});

// Actualizar Contraseña en Perfil
router.post('/perfil/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.redirect('/perfil?error=' + encodeURIComponent('La nueva contraseña debe tener como mínimo 6 caracteres.'));
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/perfil?error=' + encodeURIComponent('La confirmación de la nueva contraseña no coincide.'));
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    // Si tiene contraseña previa y no es cuenta exclusiva de Google sin password
    if (user.password && user.password.length > 0 && !user.password.startsWith('GOOGLE_OAUTH_USER_')) {
      if (!currentPassword) {
        return res.redirect('/perfil?error=' + encodeURIComponent('Debes ingresar tu contraseña actual.'));
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.redirect('/perfil?error=' + encodeURIComponent('La contraseña actual es incorrecta.'));
      }
    }

    user.password = newPassword; // el hook pre('save') se encarga de hashear con bcrypt
    await user.save();

    res.redirect('/perfil?success=' + encodeURIComponent('¡Tu contraseña fue actualizada exitosamente!'));
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.redirect('/perfil?error=' + encodeURIComponent('Error al actualizar tu contraseña. Inténtalo de nuevo.'));
  }
});

// Actualizar Datos Básicos (Nombre) en Perfil
router.post('/perfil/datos', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const cleanName = (name || '').trim();
    if (cleanName.length < 3) {
      return res.redirect('/perfil?error=' + encodeURIComponent('El nombre debe tener al menos 3 caracteres.'));
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    user.name = cleanName;
    await user.save();

    res.redirect('/perfil?success=' + encodeURIComponent('¡Tus nombres se actualizaron correctamente!'));
  } catch (error) {
    console.error('Error al actualizar datos:', error);
    res.redirect('/perfil?error=' + encodeURIComponent('Error al actualizar tus datos personales.'));
  }
});

const authController = require('../controllers/auth.controller');

router.get('/login', (req, res) => res.render('login', { error: req.query.error, success: req.query.success }));
router.get('/register', (req, res) => res.render('register', { error: req.query.error, phone: req.query.phone }));
router.get('/forgot-password', authController.renderForgotPassword);
router.get('/reset-password/:token', authController.renderResetPassword);

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
