const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  prizeValue: { type: Number, required: true },
  deliveryStatus: { type: String, enum: ['pending', 'delivered'], default: 'pending' },
  deliveryProofImage: { type: String },
  deliveryNote: { type: String },
  deliveredAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Winner', winnerSchema);
