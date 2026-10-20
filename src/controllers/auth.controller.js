const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const mailer = require('../utils/mailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Registro manual con Nombres y Apellidos
exports.register = async (req, res) => {
  const { nombres, apellidos, name, email, password, phone } = req.body;
  try {
    const firstName = (nombres || '').trim();
    const lastName = (apellidos || '').trim();
    const fullName = (firstName && lastName) 
      ? `${firstName} ${lastName}` 
      : ((name || `${firstName} ${lastName}`).trim());

    if (!fullName) {
      return res.redirect(`/register?error=${encodeURIComponent('Por favor ingresa tus nombres y apellidos')}`);
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.redirect(`/register?error=${encodeURIComponent('Por favor, ingresa un correo electrónico válido')}`);
    }

    // Validar teléfono (9 dígitos)
    if (!/^[0-9]{9}$/.test(phone)) {
      return res.redirect(`/register?error=${encodeURIComponent('El número de WhatsApp debe tener 9 dígitos')}`);
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.redirect(`/register?error=${encodeURIComponent('Este correo ya está registrado. Intenta iniciar sesión.')}`);
    }

    // Regla: Máximo 2 cuentas por número de teléfono
    const phoneCount = await User.countDocuments({ phone });
    if (phoneCount >= 2) {
      return res.redirect(`/register?error=${encodeURIComponent('Este número de WhatsApp ya alcanzó el límite máximo de 2 cuentas.')}`);
    }

    // Crear usuario
    const user = await User.create({
      name: fullName,
      firstName,
      lastName,
      email: cleanEmail,
      password,
      phone,
      role: 'user'
    });

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
    const cleanEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);
      res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
      
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else if (user.role === 'vendor') {
        res.redirect('/vendor/dashboard');
      } else {
        res.redirect('/dashboard');
      }
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

// Autenticación con Google (usando google-auth-library)
exports.googleAuth = async (req, res) => {
  const idToken = req.body.token || req.body.credential;
  if (!idToken) {
    return res.status(400).json({ success: false, error: 'Token o credencial de Google no recibida' });
  }

  try {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('Verificación local google-auth-library:', verifyErr.message, 'Intentando con tokeninfo...');
      const https = require('https');
      payload = await new Promise((resolve, reject) => {
        https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error || parsed.error_description) {
                return reject(new Error(parsed.error_description || parsed.error));
              }
              resolve(parsed);
            } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
    }

    const { email, sub, picture } = payload;
    const firstName = payload.given_name || '';
    const lastName = payload.family_name || '';
    const fullName = payload.name || `${firstName} ${lastName}`.trim() || 'Usuario Google';

    if (!email) {
      return res.status(400).json({ success: false, error: 'No se pudo obtener el correo de tu cuenta Google' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Buscar usuario por googleId o email
    let user = await User.findOne({ $or: [{ googleId: sub }, { email: cleanEmail }] });

    if (user) {
      let updated = false;
      if (!user.googleId) {
        user.googleId = sub;
        updated = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        updated = true;
      }
      if (!user.firstName && firstName) {
        user.firstName = firstName;
        updated = true;
      }
      if (!user.lastName && lastName) {
        user.lastName = lastName;
        updated = true;
      }
      if (updated) await user.save();
    } else {
      // Crear nuevo usuario registrado con Google
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await User.create({
        name: fullName,
        firstName,
        lastName,
        email: cleanEmail,
        password: randomPassword,
        phone: req.body.phone || '',
        googleId: sub,
        avatar: picture || '',
        role: 'user'
      });
    }

    const token = generateToken(user._id);
    res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

    let redirectUrl = '/dashboard';
    if (user.role === 'admin') redirectUrl = '/admin';
    else if (user.role === 'vendor') redirectUrl = '/vendor/dashboard';

    return res.json({ 
      success: true, 
      redirectUrl, 
      user: { 
        name: user.name, 
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email, 
        picture: user.avatar,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Error en autenticación con Google:', error);
    return res.status(401).json({ success: false, error: 'Token no válido: ' + error.message });
  }
};

// --- RECUPERACIÓN DE CONTRASEÑA ---

exports.renderForgotPassword = (req, res) => {
  res.render('forgot-password', { 
    error: req.query.error || null, 
    success: req.query.success || null 
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.render('forgot-password', { error: 'Por favor ingresa tu correo electrónico.', success: null });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.render('forgot-password', { 
        error: 'No existe ninguna cuenta registrada con este correo electrónico.', 
        success: null 
      });
    }

    // Generar token seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hora
    await user.save({ validateBeforeSave: false });

    // Construir URL completa
    const origin = process.env.GOOGLE_REDIRECT_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${origin}/reset-password/${resetToken}`;

    await mailer.sendPasswordResetEmail(user, resetUrl);

    res.render('forgot-password', {
      error: null,
      success: `Hemos enviado un enlace de recuperación a ${user.email}. Por favor revisa tu bandeja de entrada o carpeta de spam.`
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.render('forgot-password', { 
      error: 'Ocurrió un error al procesar tu solicitud. Inténtalo nuevamente.', 
      success: null 
    });
  }
};

exports.renderResetPassword = async (req, res) => {
  const { token } = req.params;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/forgot-password?error=' + encodeURIComponent('El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.'));
    }

    res.render('reset-password', { token, error: null });
  } catch (error) {
    console.error('Error en renderResetPassword:', error);
    res.redirect('/forgot-password?error=' + encodeURIComponent('Error al validar el enlace de recuperación.'));
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || password.length < 6) {
    return res.render('reset-password', { token, error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  if (password !== confirmPassword) {
    return res.render('reset-password', { token, error: 'Las contraseñas no coinciden.' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/forgot-password?error=' + encodeURIComponent('El enlace de recuperación es inválido o ha expirado.'));
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.redirect('/login?success=' + encodeURIComponent('¡Tu contraseña ha sido actualizada con éxito! Ya puedes iniciar sesión.'));
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.render('reset-password', { token, error: 'Error al actualizar contraseña. Inténtalo de nuevo.' });
  }
};
