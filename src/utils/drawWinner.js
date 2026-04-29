const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');

const drawRandomWinner = async (raffleId) => {
  const validTickets = await Ticket.find({ raffleId, status: 'valid' });
  
  if (validTickets.length === 0) {
    throw new Error("No hay tickets válidos para realizar el sorteo.");
  }

  // Identificar usuarios que han comprado al menos 1 ticket
  const paidTickets = validTickets.filter(t => t.paymentId != null);
  const usersWithPurchases = new Set(paidTickets.map(t => t.userId.toString()));

  // Dividir tickets en prioritarios y no prioritarios
  const priorityTickets = validTickets.filter(t => usersWithPurchases.has(t.userId.toString()));
  const lowPriorityTickets = validTickets.filter(t => !usersWithPurchases.has(t.userId.toString()));

  let winningTicket;

  if (priorityTickets.length > 0 && lowPriorityTickets.length > 0) {
    // 98% de probabilidad para tickets prioritarios, 2% para tickets solo regalados
    const rand = Math.random();
    if (rand < 0.98) {
      const winnerIndex = Math.floor(Math.random() * priorityTickets.length);
      winningTicket = priorityTickets[winnerIndex];
    } else {
      const winnerIndex = Math.floor(Math.random() * lowPriorityTickets.length);
      winningTicket = lowPriorityTickets[winnerIndex];
    }
  } else if (priorityTickets.length > 0) {
    // Solo hay tickets prioritarios
    const winnerIndex = Math.floor(Math.random() * priorityTickets.length);
    winningTicket = priorityTickets[winnerIndex];
  } else {
    // Solo hay tickets regalados (ninguna compra en todo el sorteo)
    const winnerIndex = Math.floor(Math.random() * lowPriorityTickets.length);
    winningTicket = lowPriorityTickets[winnerIndex];
  }

  return winningTicket;
};

module.exports = { drawRandomWinner };
