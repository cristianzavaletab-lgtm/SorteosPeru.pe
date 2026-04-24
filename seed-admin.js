require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    });
    console.log('Conectado a MongoDB...');

    // Eliminar todos los usuarios (limpieza para pruebas)
    await User.deleteMany({});
    console.log('Base de datos limpia.');

    // Crear admin CRISTIANZB
    const admin = await User.create({
      name: 'CRISTIANZB',
      email: 'admin@sorteosperu.pe',
      password: '60253405CZB',
      phone: '999999999',
      role: 'admin',
      status: 'active'
    });

    console.log('');
    console.log('========================================');
    console.log('   ADMIN CREADO EXITOSAMENTE');
    console.log('========================================');
    console.log('   Nombre:     CRISTIANZB');
    console.log('   Email:      admin@sorteosperu.pe');
    console.log('   Password:   60253405CZB');
    console.log('   Rol:        ADMINISTRADOR');
    console.log('========================================');
    console.log('');
    console.log('Inicia sesion en: http://localhost:3000/login');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

resetAdmin();
