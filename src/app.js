const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const app = express();

// Crear carpeta de uploads si no existe
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(uploadsDir));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

const { checkUser } = require('./middlewares/authMiddleware');

// Add auth user to locals for views
app.use(checkUser);

// Routes
app.use('/', require('./routes/index.routes'));
app.use('/', require('./routes/raffle.routes'));
app.use('/auth', require('./routes/auth.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/pagos', require('./routes/payment.routes'));

module.exports = app;
