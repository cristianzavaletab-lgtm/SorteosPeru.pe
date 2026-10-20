const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for guests
  guestName: { type: String }, // For guest users
  guestPhone: { type: String }, // For guest users
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  prizeValue: { type: Number, required: true },
  deliveryStatus: { type: String, enum: ['pending', 'delivered', 'disqualified'], default: 'pending' },
  deliveryProofImage: { type: String },
  deliveryNote: { type: String },
  deliveredAt: { type: Date },
  disqualifiedReason: { type: String },
  disqualifiedAt: { type: Date },
  attemptNumber: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Winner', winnerSchema);
