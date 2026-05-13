const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for guest buyers
  guestName: { type: String },
  guestPhone: { type: String },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  ticketNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'valid', 'winner', 'cancelled'], default: 'valid' },
  source: { type: String, enum: ['purchase', 'gift', 'business_code', 'vendor'], default: 'purchase' },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  businessCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessCode' }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
