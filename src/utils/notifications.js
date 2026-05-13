const Notification = require('../models/Notification');

/**
 * Envia una notificación interna y por Socket.io
 * @param {Object} app - Instancia de Express
 * @param {Object} data - { recipientId, role, title, message, type, link }
 */
const sendNotification = async (app, data) => {
  try {
    const notification = await Notification.create(data);
    const io = app.get('io');
    
    if (io) {
      if (data.role === 'all') {
        io.emit('notification_all', notification);
      } else if (data.role === 'admin') {
        io.emit('notification_admin', notification);
      } else if (data.recipientId) {
        io.emit(`notification_${data.recipientId}`, notification);
      }
    }
    
    return notification;
  } catch (error) {
    console.error('Error al enviar notificación:', error);
  }
};

module.exports = { sendNotification };
