require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

// Hacer que io esté disponible en toda la app
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Usuario conectado al Live:', socket.id);

  socket.on('join_raffle', (raffleId) => {
    socket.join(raffleId);
    console.log(`Usuario ${socket.id} se unió a la sala del sorteo ${raffleId}`);
  });

  socket.on('admin_spin', (data) => {
    // Retransmitir a todos los que estén viendo este sorteo
    io.to(data.raffleId).emit('user_spin', data);
  });

  socket.on('admin_spin_final', (data) => {
    io.to(data.raffleId).emit('user_spin_final', data);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to connect to database", err);
});
