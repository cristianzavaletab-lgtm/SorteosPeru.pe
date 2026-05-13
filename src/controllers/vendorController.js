const User = require('../models/User');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');
const { sendNotification } = require('../utils/notifications');

// GET /vendor/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // Fetch vendor's sales
    const sales = await Payment.find({ vendorId }).populate('raffleId').sort({ createdAt: -1 });
    
    // Calculate stats
    let totalSalesAmount = 0;
    let pendingTicketsCount = 0;
    let approvedTicketsCount = 0;
    let rejectedTicketsCount = 0;

    sales.forEach(sale => {
      if (sale.status === 'approved') {
        totalSalesAmount += sale.amount;
        approvedTicketsCount += sale.ticketQty;
      } else if (sale.status === 'pending' || sale.status === 'reviewing') {
        pendingTicketsCount += sale.ticketQty;
      } else if (sale.status === 'rejected' || sale.status === 'cancelled') {
        rejectedTicketsCount += sale.ticketQty;
      }
    });

    const commissionRate = req.user.commissionRate || 0;
    const estimatedCommission = (totalSalesAmount * commissionRate) / 100;

    res.render('vendor/dashboard', {
      user: req.user,
      sales,
      stats: {
        totalSalesAmount,
        pendingTicketsCount,
        approvedTicketsCount,
        rejectedTicketsCount,
        estimatedCommission
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading vendor dashboard');
  }
};

// GET /vendor/register-sale
exports.renderRegisterSale = async (req, res) => {
  try {
    const activeRaffles = await Raffle.find({ status: 'active' });
    res.render('vendor/register-sale', {
      user: req.user,
      raffles: activeRaffles
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading register sale form');
  }
};

// POST /vendor/register-sale
exports.registerSale = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { raffleId, guestName, guestPhone, amount, ticketQty, paymentMethod, paymentDestination } = req.body;

    let receiptImage = '';
    if (req.file) {
      receiptImage = req.file.filename;
    }

    // Validation for non-cash if destination is official
    if (paymentDestination === 'official' && !receiptImage && paymentMethod !== 'cash') {
       // Should probably redirect back with error, for simplicity using standard error handling
       return res.status(400).send('Se requiere comprobante para pagos a cuenta oficial.');
    }

    // 1. Create Payment
    const payment = new Payment({
      vendorId,
      guestName,
      guestPhone,
      raffleId,
      amount,
      ticketQty,
      paymentMethod,
      paymentDestination,
      receiptImage,
      status: 'pending' // As requested: starts as pending
    });

    await payment.save();

    // 2. Generate Pending Tickets
    // Helper function to generate ticket numbers
    const generateTicketNumber = async (raffleId) => {
      let number;
      let exists = true;
      while (exists) {
        number = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit
        const existingTicket = await Ticket.findOne({ raffleId, ticketNumber: number });
        if (!existingTicket) exists = false;
      }
      return number;
    };

    const tickets = [];
    for (let i = 0; i < ticketQty; i++) {
      const ticketNumber = await generateTicketNumber(raffleId);
      const ticket = new Ticket({
        guestName,
        guestPhone,
        vendorId,
        raffleId,
        paymentId: payment._id,
        ticketNumber,
        status: 'pending',
        source: 'vendor'
      });
      tickets.push(ticket);
    }

    await Ticket.insertMany(tickets);

    // Notificar al Admin
    await sendNotification(req.app, {
      role: 'admin',
      title: 'Nueva Venta de Vendedor',
      message: `El vendedor ${req.user.name} registró una venta de S/ ${amount} (${ticketQty} tickets).`,
      type: 'sale_new',
      link: '/admin/pagos'
    });

    res.redirect('/vendor/dashboard?success=Venta registrada correctamente');

  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering sale');
  }
};
