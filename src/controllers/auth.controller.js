const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.redirect(`/register?error=${encodeURIComponent('Por favor, ingresa un correo electrónico válido')}`);
    }

    // Validar teléfono (9 dígitos)
    if (!/^[0-9]{9}$/.test(phone)) {
      return res.redirect(`/register?error=${encodeURIComponent('El número de WhatsApp debe tener 9 dígitos')}`);
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.redirect(`/register?error=${encodeURIComponent('Este correo ya está registrado. Intenta iniciar sesión.')}`);
    }

    // Regla: Máximo 2 cuentas por número de teléfono
    const phoneCount = await User.countDocuments({ phone });
    if (phoneCount >= 2) {
      return res.redirect(`/register?error=${encodeURIComponent('Este número de WhatsApp ya alcanzó el límite máximo de 2 cuentas.')}`);
    }

    // Siempre se crea como usuario normal. El admin se crea con seed-admin.js
    const user = await User.create({ name, email, password, phone, role: 'user' });

    const token = generateToken(user._id);
    res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
  } catch (error) {
    console.error("ERROR AL REGISTRAR:", error);
    res.redirect(`/register?error=${encodeURIComponent('Error en el servidor: ' + error.message)}`);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);
      res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.redirect('/dashboard');
    } else {
      res.redirect(`/login?error=${encodeURIComponent('Email o contraseña inválida')}`);
    }
  } catch (error) {
    res.redirect(`/login?error=${encodeURIComponent('Error en el servidor')}`);
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/');
};
