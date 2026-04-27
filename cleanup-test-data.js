require('dotenv').config();
const mongoose = require('mongoose');
const Raffle = require('./src/models/Raffle');
const Ticket = require('./src/models/Ticket');
const Payment = require('./src/models/Payment');
const Winner = require('./src/models/Winner');
const User = require('./src/models/User');

const cleanup = async () => {
  try {
    console.log('Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conexión establecida.');

    console.log('Eliminando tickets...');
    await Ticket.deleteMany({});
    
    console.log('Eliminando pagos...');
    await Payment.deleteMany({});
    
    console.log('Eliminando ganadores...');
    await Winner.deleteMany({});
    
    console.log('Eliminando sorteos...');
    await Raffle.deleteMany({});

    // IMPORTANTE: NO eliminamos Usuarios.
    const userCount = await User.countDocuments();
    console.log(`Datos de prueba eliminados. Se mantuvieron ${userCount} usuarios registrados.`);

    process.exit(0);
  } catch (error) {
    console.error('Error durante la limpieza:', error);
    process.exit(1);
  }
};

cleanup();
