const Ticket = require('../models/Ticket');

const generateTicketNumber = async () => {
  let isUnique = false;
  let ticketNumber = '';

  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    ticketNumber = `GC-${randomNum}`;
    
    const existingTicket = await Ticket.findOne({ ticketNumber });
    if (!existingTicket) {
      isUnique = true;
    }
  }

  return ticketNumber;
};

module.exports = { generateTicketNumber };
