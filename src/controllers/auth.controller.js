const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).send('El usuario ya existe');
    }

    // Siempre se crea como usuario normal. El admin se crea con seed-admin.js
    const user = await User.create({ name, email, password, phone, role: 'user' });

    const token = generateToken(user._id);
    res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
  } catch (error) {
    console.error("ERROR AL REGISTRAR:", error);
    res.status(500).send('Error en el servidor: ' + error.message);
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
      res.status(401).send('Email o contraseña inválida');
    }
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/');
};
