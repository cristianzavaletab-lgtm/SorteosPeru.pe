const Payment = require('../models/Payment');
const Raffle = require('../models/Raffle');

// Verifica si el sorteo aún acepta compras
const isClosed = (raffle) => {
  if (raffle.status !== 'active') return true;
  if (raffle.drawDate) {
    const now = new Date();
    const closeTime = new Date(raffle.drawDate.getTime() - 60000); // 1 minuto antes
    if (now >= closeTime) return true;
  }
  return false;
};

exports.getPaymentPage = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).send('Sorteo no encontrado');

    const closed = isClosed(raffle);
    const qty = parseInt(req.query.qty) || 1;
    const totalAmount = qty * raffle.ticketPrice;
    res.render('payment', { raffle, closed, qty, totalAmount });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
};

exports.submitPayment = async (req, res) => {
  try {
    const raffleId = req.params.id;
    const raffle = await Raffle.findById(raffleId);

    // Verificar que el sorteo aún acepte compras
    if (!raffle || isClosed(raffle)) {
      return res.status(400).send('Este sorteo ya está cerrado. No se aceptan más compras.');
    }

    const { amount, paymentMethod, ticketQty } = req.body;
    const receiptImage = req.file ? `/uploads/${req.file.filename}` : null;

    if (!receiptImage) {
      return res.status(400).send('Debe subir un comprobante');
    }

    const payment = await Payment.create({
      userId: req.user._id,
      raffleId,
      amount,
      paymentMethod,
      receiptImage,
      ticketQty: parseInt(ticketQty) || 1
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al enviar el pago');
  }
};
