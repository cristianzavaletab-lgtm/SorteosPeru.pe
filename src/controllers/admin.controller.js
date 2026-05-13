const Raffle = require('../models/Raffle');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');
const { sendNotification } = require('../utils/notifications');
const User = require('../models/User');
const exceljs = require('exceljs');
const pushController = require('./push.controller');
const { generateTicketNumber } = require('../utils/generateTicket');
const { drawRandomWinner } = require('../utils/drawWinner');

exports.getDashboard = async (req, res) => {
  try {
    const { raffleId } = req.query;

    const totalUsers = await User.countDocuments();
    const activeRaffles = await Raffle.countDocuments({ status: 'active' });
    
    // Filtros dinámicos
    const paymentFilter = { status: 'pending' };
    const ticketSoldFilter = { status: 'valid', paymentId: { $ne: null } };
    const ticketGiftedFilter = { status: 'valid', paymentId: null };

    if (raffleId) {
      paymentFilter.raffleId = raffleId;
      ticketSoldFilter.raffleId = raffleId;
      ticketGiftedFilter.raffleId = raffleId;
    }

    const pendingPayments = await Payment.countDocuments(paymentFilter);
    const ticketsSold = await Ticket.countDocuments(ticketSoldFilter);
    const ticketsGifted = await Ticket.countDocuments(ticketGiftedFilter);
    
    const allRaffles = await Raffle.find().sort({ createdAt: -1 });

    // Estadísticas por sorteo activo
    const activeRafflesList = await Raffle.find({ status: 'active' });
    const raffleStats = await Promise.all(activeRafflesList.map(async (raffle) => {
      const sold = await Ticket.countDocuments({ raffleId: raffle._id, status: 'valid', paymentId: { $ne: null } });
      const gifted = await Ticket.countDocuments({ raffleId: raffle._id, status: 'valid', paymentId: null });
      return {
        title: raffle.title,
        sold,
        gifted,
        revenue: sold * raffle.ticketPrice
      };
    }));

    res.render('admin/dashboard', { 
      totalUsers, activeRaffles, pendingPayments, ticketsSold, ticketsGifted, raffleStats,
      allRaffles, selectedRaffleId: raffleId 
    });
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

    // Verificar si ya existen tickets pendientes (ej. venta de vendedor)
    const existingPendingTickets = await Ticket.find({ paymentId: payment._id, status: 'pending' });
    const ticketNumbers = [];
    const qty = payment.ticketQty || 1;

    if (existingPendingTickets.length > 0) {
      // Es una venta de vendedor, solo actualizar estado
      for (const ticket of existingPendingTickets) {
        ticket.status = 'valid';
        await ticket.save();
        ticketNumbers.push(ticket.ticketNumber);
      }
    } else {
      // Venta web normal, generar tickets
      for (let i = 0; i < qty; i++) {
        const ticketNumber = await generateTicketNumber();
        const ticketData = {
          raffleId: payment.raffleId._id,
          paymentId: payment._id,
          ticketNumber,
          status: 'valid'
        };
        if (payment.userId) ticketData.userId = payment.userId._id;
        if (payment.guestName) ticketData.guestName = payment.guestName;
        if (payment.guestPhone) ticketData.guestPhone = payment.guestPhone;

        await Ticket.create(ticketData);
        ticketNumbers.push(ticketNumber);
      }
    }

    // Premiar con 10-20 créditos SP SOLO si compró más de 2 tickets y tiene cuenta
    if (qty > 2 && payment.userId) {
      const spPerTicket = Math.floor(Math.random() * 11) + 10; // 10 a 20
      const creditsAwarded = qty * spPerTicket;
      const user = await User.findById(payment.userId._id);
      if (user) {
        user.credits = (user.credits || 0) + creditsAwarded;
        await user.save();
      }
    }

    const io = req.app.get('io');
    if (payment.userId) {
      io.emit('user_update', { userId: payment.userId._id, message: '¡Tu pago ha sido aprobado! Tienes nuevos tickets.' });
    }
    io.emit('admin_update', { message: 'Pago aprobado y tickets generados' });

    // Enviar Notificación Push si es usuario web
    if (payment.userId) {
      pushController.sendNotification(payment.userId._id, {
        title: '✅ ¡Pago Aprobado!',
        body: `Tu pago para "${payment.raffleId.title}" fue aprobado. ¡Mucha suerte! 🍀`,
        url: '/dashboard'
      });
    }

    // Notificación Persistente para el Vendedor
    await sendNotification(req.app, {
      recipientId: payment.vendorId,
      role: 'vendor',
      title: 'Venta Aprobada',
      message: `Tu registro de venta por S/ ${payment.amount} para ${payment.guestName || 'un cliente'} ha sido aprobado.`,
      type: 'sale_approved',
      link: '/vendor/dashboard'
    });

    // Redirigir a WhatsApp con mensaje de aprobación
    const phone = payment.userId ? payment.userId.phone : payment.guestPhone;
    const name = payment.userId ? payment.userId.name : payment.guestName;
    
    if (phone) {
      const cleanPhone = phone.replace(/\s/g, '');
      const phoneFormatted = cleanPhone.startsWith('51') ? cleanPhone : '51' + cleanPhone;
      const ticketList = ticketNumbers.map(t => `🎫 *${t}*`).join('\n');
      const message = encodeURIComponent(
        `¡Hola ${name}! 🎉\n\n` +
        `Tu pago de S/${payment.amount.toFixed(2)} para el sorteo "${payment.raffleId.title}" ha sido *APROBADO* ✅\n\n` +
        `${qty > 1 ? `Tus ${qty} tickets son:\n` : 'Tu ticket es:\n'}` +
        `${ticketList}\n\n` +
        `¡Ya estás participando! Te avisaremos cuando se realice el sorteo.\n\n` +
        `Buena suerte 🍀\n` +
        `— SorteosPeru.pe`
      );
      return res.redirect(`https://wa.me/${phoneFormatted}?text=${message}`);
    }
    
    return res.redirect('/admin/pagos');
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

    // Cancelar tickets pendientes si existen
    const existingPendingTickets = await Ticket.find({ paymentId: payment._id, status: 'pending' });
    if (existingPendingTickets.length > 0) {
      for (const ticket of existingPendingTickets) {
        ticket.status = 'cancelled';
        await ticket.save();
      }
    }

    const io = req.app.get('io');
    if (payment.userId) {
      io.emit('user_update', { userId: payment.userId._id, message: `Tu pago fue rechazado: ${reason}` });
    }
    io.emit('admin_update', { message: 'Pago rechazado' });

    // Enviar Notificación Push si es usuario web
    if (payment.userId) {
      pushController.sendNotification(payment.userId._id, {
        title: '❌ Pago Rechazado',
        body: `Tu pago para "${payment.raffleId.title}" fue rechazado: ${reason}`,
        url: '/dashboard'
      });
    }

    // Notificación Persistente para el Vendedor
    await sendNotification(req.app, {
      recipientId: payment.vendorId,
      role: 'vendor',
      title: 'Venta Rechazada',
      message: `Tu registro de venta por S/ ${payment.amount} ha sido rechazado.`,
      type: 'sale_rejected',
      link: '/vendor/dashboard'
    });

    // Redirigir a WhatsApp con mensaje de rechazo
    const phone = payment.userId ? payment.userId.phone : payment.guestPhone;
    const name = payment.userId ? payment.userId.name : payment.guestName;
    
    if (phone) {
      const cleanPhone = phone.replace(/\s/g, '');
      const phoneFormatted = cleanPhone.startsWith('51') ? cleanPhone : '51' + cleanPhone;
      const message = encodeURIComponent(
        `Hola ${name},\n\n` +
        `Tu pago de S/${payment.amount.toFixed(2)} para el sorteo "${payment.raffleId.title}" fue *RECHAZADO* ❌\n\n` +
        `📋 Motivo: ${reason}\n\n` +
        `Puedes comunicarte con nosotros para solucionarlo.\n\n` +
        `— SorteosPeru.pe`
      );
      return res.redirect(`https://wa.me/${phoneFormatted}?text=${message}`);
    }
    
    return res.redirect('/admin/pagos');
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
    const raffle = await Raffle.create(data);

    // Notificar a todos sobre el nuevo sorteo
    await sendNotification(req.app, {
      role: 'all',
      title: '¡Nuevo Sorteo Disponible! 🎁',
      message: `Se ha activado el sorteo "${raffle.title}". ¡Compra tu ticket ahora!`,
      type: 'system',
      link: '/sorteos/' + raffle._id
    });

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
    raffle.streamUrl = req.body.streamUrl || null;
    const oldStatus = raffle.status;
    raffle.status = req.body.status;
    
    if (raffle.status === 'active' && oldStatus !== 'active') {
      await sendNotification(req.app, {
        role: 'all',
        title: '¡Sorteo Activado! 🚀',
        message: `El sorteo "${raffle.title}" ya está disponible para participar.`,
        type: 'system',
        link: '/sorteos/' + raffle._id
      });
    }
    
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

    let winnerData = {
      raffleId: raffle._id,
      ticketId: winningTicket._id,
      prizeValue: raffle.prizeValue
    };

    let winnerName = winningTicket.guestName || 'Usuario Desconocido';
    let winnerPhone = winningTicket.guestPhone || 'Sin número';

    if (winningTicket.userId) {
      const winnerUser = await User.findById(winningTicket.userId);
      winnerData.userId = winningTicket.userId;
      if (winnerUser) {
        winnerName = winnerUser.name;
        winnerPhone = winnerUser.phone;
      }
    } else {
      winnerData.guestName = winningTicket.guestName;
      winnerData.guestPhone = winningTicket.guestPhone;
    }

    const winner = await Winner.create(winnerData);

    // Notificar al Ganador (si es usuario registrado)
    if (winningTicket.userId) {
      await sendNotification(req.app, {
        recipientId: winningTicket.userId,
        role: 'user',
        title: '¡ERES EL GANADOR! 🏆',
        message: `¡Felicidades! Ganaste el premio de S/ ${raffle.prizeValue} en el sorteo "${raffle.title}".`,
        type: 'winner',
        link: '/mis-tickets'
      });
    }

    // Devolver JSON para la ruleta
    res.json({
      success: true,
      winner: {
        name: winnerName,
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

    // Premiar con 20 créditos SP por cada ticket regalado
    const creditsAwarded = parseInt(qty) * 20;
    const user = await User.findById(userId);
    if (user) {
      user.credits = (user.credits || 0) + creditsAwarded;
      await user.save();
    }

    const io = req.app.get('io');
    io.emit('user_update', { userId, message: '🎁 ¡Felicidades! Has recibido tickets de regalo del administrador.' });

    // Enviar Notificación Push
    pushController.sendNotification(userId, {
      title: '🎁 ¡Tienes un Regalo!',
      body: `El administrador te ha regalado ${qty} tickets para un sorteo. ¡Revísalos!`,
      url: '/dashboard'
    });

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

// --- Gestión de Vendedores ---
const bcrypt = require('bcryptjs');

exports.getVendors = async (req, res) => {
  try {
    const vendors = await User.find({ role: 'vendor' }).sort({ createdAt: -1 });
    
    // Calcular estadísticas por vendedor
    const vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
      const sales = await Payment.find({ vendorId: vendor._id, status: 'approved' });
      const pendingSales = await Payment.find({ vendorId: vendor._id, status: { $in: ['pending', 'reviewing'] } });
      
      let totalAmountSold = 0;
      let amountCollectedByVendor = 0; // Efectivo o Yape que el vendedor tiene en el bolsillo

      sales.forEach(s => {
        totalAmountSold += s.amount;
        if (s.paymentDestination === 'vendor') {
          amountCollectedByVendor += s.amount;
        }
      });
      
      const estimatedCommission = (totalAmountSold * (vendor.commissionRate || 0)) / 100;
      const amountToRemitToAdmin = amountCollectedByVendor - estimatedCommission;
      
      return {
        ...vendor.toObject(),
        approvedSalesCount: sales.length,
        pendingSalesCount: pendingSales.length,
        totalAmountSold,
        amountCollectedByVendor,
        estimatedCommission,
        amountToRemitToAdmin: amountToRemitToAdmin > 0 ? amountToRemitToAdmin : 0
      };
    }));

    res.render('admin/vendors', { vendors: vendorsWithStats });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener vendedores');
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, email, phone, password, vendorCode, commissionRate } = req.body;
    
    await User.create({
      name,
      email,
      phone,
      password, // The pre-save hook in User schema will hash this
      role: 'vendor',
      vendorCode,
      commissionRate: parseFloat(commissionRate) || 0
    });

    res.redirect('/admin/vendedores?success=Vendedor Creado');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear vendedor');
  }
};
