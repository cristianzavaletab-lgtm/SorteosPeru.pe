const mongoose = require('mongoose');

const businessCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessCampaign', required: true },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  status: { type: String, enum: ['available', 'used', 'expired'], default: 'available' },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('BusinessCode', businessCodeSchema);
