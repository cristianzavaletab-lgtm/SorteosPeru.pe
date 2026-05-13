const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for guest buyers
  guestName: { type: String },
  guestPhone: { type: String },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentDestination: { type: String, enum: ['official', 'vendor'], default: 'official' },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  amount: { type: Number, required: true },
  ticketQty: { type: Number, default: 1 },
  paymentMethod: { type: String, enum: ['yape', 'plin', 'cash', 'transfer'], required: true },
  receiptImage: { type: String }, // Optional for cash payments where there's no receipt yet
  status: { type: String, enum: ['pending', 'reviewing', 'approved', 'rejected', 'expired'], default: 'pending' },
  rejectionReason: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
