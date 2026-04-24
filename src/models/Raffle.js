const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  prizeType: { type: String, enum: ['cash', 'product'], default: 'cash' },
  prizeValue: { type: Number, required: true },
  prizeDescription: { type: String },
  ticketPrice: { type: Number, required: true },
  maxParticipants: { type: Number, required: true },
  image: { type: String }, // Imagen promocional (opcional)
  status: { 
    type: String, 
    enum: ['draft', 'active', 'completed', 'cancelled'], 
    default: 'draft' 
  },
  startDate: { type: Date },
  endDate: { type: Date },
  drawDate: { type: Date }, // Fecha y hora exacta del sorteo
  winnerTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }
}, { timestamps: true });

module.exports = mongoose.model('Raffle', raffleSchema);
