const mongoose = require('mongoose');

const uri = "mongodb+srv://zavaletacristian77_db_user:KbI0dhgCDjCVbYoR@sorteos.znxecbn.mongodb.net/sorteos_peru?retryWrites=true&w=majority&appName=Sorteos";

mongoose.connect(uri)
  .then(() => {
    console.log("Conectado exitosamente!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error exacto:", err);
    process.exit(1);
  });
