const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');

exports.getHome = async (req, res) => {
  try {
    const activeRaffles = await Raffle.find({ status: 'active' }).sort({ createdAt: -1 });
    const winners = await Winner.find({}).populate('userId').populate('raffleId').sort({ createdAt: -1 }).limit(5);
    res.render('home', { activeRaffles, winners });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
};

exports.getRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find({ status: 'active' });
    res.render('raffles', { raffles });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
};

exports.getRaffleDetail = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    const ticketCount = await Ticket.countDocuments({ raffleId: raffle._id, status: { $in: ['valid', 'winner'] } });
    res.render('raffle-detail', { raffle, ticketCount });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
};
