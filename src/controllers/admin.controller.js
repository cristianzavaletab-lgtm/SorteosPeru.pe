const Raffle = require('../models/Raffle');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const User = require('../models/User');
const { generateTicketNumber } = require('../utils/generateTicket');
const { drawRandomWinner } = require('../utils/drawWinner');

exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeRaffles = await Raffle.countDocuments({ status: 'active' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const ticketsSold = await Ticket.countDocuments({ status: 'valid' });

    res.render('admin/dashboard', { totalUsers, activeRaffles, pendingPayments, ticketsSold });
  } catch (error) {
    res.status(500).send('Error en el panel');
  }
};

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending' }).populate('userId').populate('raffleId');
    res.render('admin/payments', { payments });
  } catch (error) {
    res.status(500).send('Error al obtener pagos');
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('userId').populate('raffleId');
    if (!payment) return res.status(404).send('Pago no encontrado');

    payment.status = 'approved';
    payment.approvedBy = req.user._id;
    payment.approvedAt = Date.now();
    await payment.save();

    // Generar N tickets según la cantidad comprada
    const qty = payment.ticketQty || 1;
    const ticketNumbers = [];
    for (let i = 0; i < qty; i++) {
      const ticketNumber = await generateTicketNumber();
      await Ticket.create({
        userId: payment.userId._id,
        raffleId: payment.raffleId._id,
        paymentId: payment._id,
        ticketNumber
      });
      ticketNumbers.push(ticketNumber);
    }

    // Redirigir a WhatsApp con mensaje de aprobación
    const phone = payment.userId.phone.replace(/\s/g, '');
    const phoneFormatted = phone.startsWith('51') ? phone : '51' + phone;
    const ticketList = ticketNumbers.map(t => `🎫 *${t}*`).join('\n');
    const message = encodeURIComponent(
      `¡Hola ${payment.userId.name}! 🎉\n\n` +
      `Tu pago de S/${payment.amount.toFixed(2)} para el sorteo "${payment.raffleId.title}" ha sido *APROBADO* ✅\n\n` +
      `${qty > 1 ? `Tus ${qty} tickets son:\n` : 'Tu ticket es:\n'}` +
      `${ticketList}\n\n` +
      `¡Ya estás participando! Te avisaremos cuando se realice el sorteo.\n\n` +
      `Buena suerte 🍀\n` +
      `— SorteosPeru.pe`
    );
    
    res.redirect(`https://wa.me/${phoneFormatted}?text=${message}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al aprobar el pago');
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('userId').populate('raffleId');
    if (!payment) return res.status(404).send('Pago no encontrado');

    const reason = req.body.reason || 'Comprobante inválido o ilegible';
    payment.status = 'rejected';
    payment.rejectionReason = reason;
    await payment.save();

    // Redirigir a WhatsApp con mensaje de rechazo
    const phone = payment.userId.phone.replace(/\s/g, '');
    const phoneFormatted = phone.startsWith('51') ? phone : '51' + phone;
    const message = encodeURIComponent(
      `Hola ${payment.userId.name},\n\n` +
      `Tu pago de S/${payment.amount.toFixed(2)} para el sorteo "${payment.raffleId.title}" fue *RECHAZADO* ❌\n\n` +
      `📋 Motivo: ${reason}\n\n` +
      `Puedes volver a intentarlo subiendo un comprobante válido.\n\n` +
      `— SorteosPeru.pe`
    );
    
    res.redirect(`https://wa.me/${phoneFormatted}?text=${message}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al rechazar el pago');
  }
};

exports.getRaffles = async (req, res) => {
  try {
    const rafflesRaw = await Raffle.find().sort({ createdAt: -1 });
    
    // Adjuntar conteo de tickets a cada sorteo
    const raffles = await Promise.all(rafflesRaw.map(async (r) => {
      const ticketCount = await Ticket.countDocuments({ raffleId: r._id });
      return { ...r.toObject(), ticketCount };
    }));

    // Si viene ?edit=ID, cargar el sorteo a editar
    let editRaffle = null;
    if (req.query.edit) {
      editRaffle = await Raffle.findById(req.query.edit);
    }
    
    res.render('admin/raffles', { raffles, editRaffle });
  } catch (error) {
    res.status(500).send('Error al obtener sorteos');
  }
};

exports.deleteRaffle = async (req, res) => {
  try {
    const ticketCount = await Ticket.countDocuments({ raffleId: req.params.id });
    if (ticketCount > 0) {
      return res.status(400).send('No se puede eliminar un sorteo con tickets comprados');
    }
    
    await Raffle.findByIdAndDelete(req.params.id);
    res.redirect('/admin/sorteos');
  } catch (error) {
    res.status(500).send('Error al eliminar sorteo');
  }
};

exports.createRaffle = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.image = `/uploads/${req.file.filename}`;
    }
    await Raffle.create(data);
    res.redirect('/admin/sorteos');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear sorteo: ' + error.message);
  }
};

exports.updateRaffle = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).send('Sorteo no encontrado');
    
    raffle.title = req.body.title;
    raffle.description = req.body.description;
    raffle.prizeValue = req.body.prizeValue;
    raffle.ticketPrice = req.body.ticketPrice;
    raffle.maxParticipants = req.body.maxParticipants;
    raffle.startDate = req.body.startDate || null;
    raffle.endDate = req.body.endDate || null;
    raffle.drawDate = req.body.drawDate || null;
    raffle.status = req.body.status;
    
    if (req.file) {
      raffle.image = `/uploads/${req.file.filename}`;
    }
    
    await raffle.save();
    res.redirect('/admin/sorteos');
  } catch (error) {
    res.status(500).send('Error al actualizar sorteo');
  }
};

exports.getDrawPage = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    const tickets = await Ticket.find({ raffleId: raffle._id, status: 'valid' }).populate('userId');
    res.render('admin/draw', { raffle, tickets });
  } catch (error) {
    res.status(500).send('Error al cargar página de sorteo');
  }
};

exports.executeDraw = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (raffle.status !== 'active') return res.status(400).json({ error: 'El sorteo no está activo' });

    const winningTicket = await drawRandomWinner(raffle._id);
    
    winningTicket.status = 'winner';
    await winningTicket.save();

    raffle.status = 'completed';
    raffle.winnerTicketId = winningTicket._id;
    await raffle.save();

    const winnerUser = await User.findById(winningTicket.userId);

    const winner = await Winner.create({
      raffleId: raffle._id,
      userId: winningTicket.userId,
      ticketId: winningTicket._id,
      prizeValue: raffle.prizeValue
    });

    // Devolver JSON para la ruleta
    res.json({
      success: true,
      winner: {
        id: winner._id,
        name: winnerUser.name,
        phone: winnerUser.phone,
        ticketNumber: winningTicket.ticketNumber,
        prize: raffle.prizeValue
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al ejecutar sorteo' });
  }
};

exports.getWinner = async (req, res) => {
  try {
    const winner = await Winner.findById(req.params.id).populate('userId').populate('ticketId');
    res.render('admin/winner', { winner });
  } catch (error) {
    res.status(500).send('Error al cargar ganador');
  }
};

// Lista completa de ganadores
exports.getWinners = async (req, res) => {
  try {
    const winners = await Winner.find()
      .populate('userId')
      .populate('raffleId')
      .populate('ticketId')
      .sort({ createdAt: -1 });
    res.render('admin/winners', { winners });
  } catch (error) {
    res.status(500).send('Error al cargar ganadores');
  }
};

// Marcar premio como entregado
exports.deliverPrize = async (req, res) => {
  try {
    const winner = await Winner.findById(req.params.id);
    if (!winner) return res.status(404).send('Ganador no encontrado');
    
    winner.deliveryStatus = 'delivered';
    winner.deliveredAt = new Date();
    await winner.save();
    
    res.redirect('/admin/ganadores');
  } catch (error) {
    res.status(500).send('Error al actualizar entrega');
  }
};
