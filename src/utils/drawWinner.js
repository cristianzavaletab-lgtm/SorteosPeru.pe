const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');

const drawRandomWinner = async (raffleId) => {
  const validTickets = await Ticket.find({ raffleId, status: 'valid' });
  
  if (validTickets.length === 0) {
    throw new Error("No hay tickets válidos para realizar el sorteo.");
  }

  const winnerIndex = Math.floor(Math.random() * validTickets.length);
  const winningTicket = validTickets[winnerIndex];

  return winningTicket;
};

module.exports = { drawRandomWinner };
