const mongoose = require('mongoose');

const businessCampaignSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  purchasedTickets: { type: Number, required: true, default: 0 },
  bonusTickets: { type: Number, required: true, default: 0 },
  totalCodes: { type: Number, required: true, default: 0 },
  usedCodes: { type: Number, default: 0 },
  availableCodes: { type: Number, default: 0 },
  expiresAt: { type: Date },
  status: { type: String, enum: ['active', 'finished', 'cancelled'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('BusinessCampaign', businessCampaignSchema);
