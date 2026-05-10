const PushSubscription = require('../models/PushSubscription');
const webpush = require('web-push');

// Configurar web-push (solo si las llaves existen para evitar crashes)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@sorteosperu.pe',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ ADVERTENCIA: VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configuradas en .env. Las notificaciones Push no funcionarán.');
}

exports.subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user._id; // Asumiendo que hay un middleware que pone el usuario en req

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Suscripción inválida' });
    }

    // Guardar o actualizar la suscripción
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      { 
        userId, 
        subscription,
        deviceInfo: req.headers['user-agent']
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Suscrito con éxito a las notificaciones' });
  } catch (error) {
    console.error('Error en suscripción push:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.findOneAndDelete({ 'subscription.endpoint': endpoint });
    res.status(200).json({ message: 'Suscripción eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar suscripción' });
  }
};

// Función auxiliar para enviar notificaciones (no es un endpoint)
exports.sendNotification = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    
    const notifications = subscriptions.map(sub => {
      return webpush.sendNotification(sub.subscription, JSON.stringify(payload))
        .catch(async (err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Suscripción expirada o inválida, eliminarla
            await PushSubscription.findByIdAndDelete(sub._id);
          }
          console.error('Error enviando notificación push:', err);
        });
    });

    return Promise.all(notifications);
  } catch (error) {
    console.error('Error en sendNotification utility:', error);
  }
};
