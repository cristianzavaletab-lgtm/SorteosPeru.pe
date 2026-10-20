require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const User = require('./src/models/User');

const resetAdmin = async () => {
  try {
    const requiredVariables = ['MONGODB_URI', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PHONE'];
    const missingVariables = requiredVariables.filter((variable) => !process.env[variable]);

    if (missingVariables.length > 0) {
      throw new Error(`Faltan variables requeridas: ${missingVariables.join(', ')}`);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    });
    console.log('Conectado a MongoDB...');

    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const admin = await User.findOne({ email });
    const adminData = {
      name: process.env.ADMIN_NAME.trim(),
      email,
      password: process.env.ADMIN_PASSWORD,
      phone: process.env.ADMIN_PHONE.trim(),
      role: 'admin',
      status: 'active'
    };

    if (admin) {
      Object.assign(admin, adminData);
      await admin.save();
    } else {
      await User.create(adminData);
    }

    console.log('');
    console.log('========================================');
    console.log('   ADMIN CREADO EXITOSAMENTE');
    console.log('========================================');
    console.log(`   Nombre:     ${adminData.name}`);
    console.log(`   Email:      ${adminData.email}`);
    console.log('   Rol:        ADMINISTRADOR');
    console.log('========================================');
    console.log('');
    console.log('Ya puedes iniciar sesión con las credenciales configuradas.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

resetAdmin();
