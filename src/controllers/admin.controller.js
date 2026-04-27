const Raffle = require('../models/Raffle');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const User = require('../models/User');
const exceljs = require('exceljs');
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

// --- Gestión de Usuarios ---

exports.getUsers = async (req, res) => {
  try {
    const { raffleId } = req.query;
    const usersRaw = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    
    const allRaffles = await Raffle.find().sort({ createdAt: -1 });
    const activeRaffles = allRaffles.filter(r => r.status === 'active');

    let users = await Promise.all(usersRaw.map(async (u) => {
      const filter = { userId: u._id };
      if (raffleId) filter.raffleId = raffleId;
      
      const ticketCount = await Ticket.countDocuments(filter);
      return { ...u.toObject(), ticketCount };
    }));

    res.render('admin/users', { 
      users, 
      activeRaffles, 
      allRaffles, 
      selectedRaffleId: raffleId 
    });
  } catch (error) {
    console.error("Error in getUsers:", error);
    res.status(500).send('Error al obtener usuarios');
  }
};

exports.giftTickets = async (req, res) => {
  try {
    const { raffleId, qty } = req.body;
    const userId = req.params.id;

    if (!raffleId || !qty) return res.status(400).send('Faltan datos');

    const ticketNumbers = [];
    for (let i = 0; i < parseInt(qty); i++) {
      const ticketNumber = await generateTicketNumber();
      await Ticket.create({
        userId,
        raffleId,
        ticketNumber,
        status: 'valid'
      });
      ticketNumbers.push(ticketNumber);
    }

    res.redirect('/admin/usuarios?success=tickets_regalados');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al regalar tickets');
  }
};

exports.exportData = async (req, res) => {
  try {
    const { raffleId } = req.query;
    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('Registrados y Compradores');

    let raffleTitle = 'Todos los sorteos';
    if (raffleId) {
      const raffle = await Raffle.findById(raffleId);
      if (raffle) raffleTitle = raffle.title;
    }

    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Fecha Registro', key: 'createdAt', width: 20 },
      { header: 'Tickets (' + raffleTitle + ')', key: 'ticketCount', width: 20 },
      { header: 'Números de Ticket', key: 'ticketNumbers', width: 50 }
    ];

    const users = await User.find({ role: 'user' });

    for (const user of users) {
      const filter = { userId: user._id };
      if (raffleId) filter.raffleId = raffleId;

      const tickets = await Ticket.find(filter).populate('raffleId');
      const ticketNumbers = tickets.map(t => `${t.ticketNumber} (${t.raffleId ? t.raffleId.title : 'N/A'})`).join(', ');
      
      // Si filtramos por sorteo, solo exportar los que tienen tickets en ese sorteo
      if (raffleId && tickets.length === 0) continue;

      sheet.addRow({
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toLocaleDateString(),
        ticketCount: tickets.length,
        ticketNumbers: ticketNumbers
      });
    }

    // Estilo para el encabezado
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `Reporte_SorteosPeru_${new Date().toISOString().slice(0,10)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al exportar datos');
  }
};
