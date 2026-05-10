const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    endpoint: { type: String, required: true },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  deviceInfo: { type: String }, // Opcional: para identificar el dispositivo
}, { timestamps: true });

// Evitar duplicados para la misma suscripción
pushSubscriptionSchema.index({ 'subscription.endpoint': 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
