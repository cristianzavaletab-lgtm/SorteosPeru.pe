require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Falta la variable MONGODB_URI.');
  process.exit(1);
}

mongoose.connect(uri)
  .then(() => {
    console.log("Conectado exitosamente!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error exacto:", err);
    process.exit(1);
  });
