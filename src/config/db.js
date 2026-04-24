const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        family: 4
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`Intento ${i + 1}/${retries} fallido: ${error.message}`);
      if (i < retries - 1) {
        const delay = Math.min(2000 * (i + 1), 10000);
        console.log(`Reintentando en ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('No se pudo conectar a MongoDB después de todos los intentos.');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
