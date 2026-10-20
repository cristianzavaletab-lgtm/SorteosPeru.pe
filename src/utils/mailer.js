const nodemailer = require('nodemailer');

// Crear transportador de nodemailer
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (!user || !pass) {
    // Si no están configuradas las credenciales SMTP aún, retornar null para modo simulación seguro
    return null;
  }

  // Si es Gmail o Google Workspace (tecsup.edu.pe / gmail.com), usar service: 'gmail' para máxima fiabilidad
  if (host === 'smtp.gmail.com' || host === 'gmail' || user.includes('gmail') || user.includes('tecsup.edu.pe')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

/**
 * Plantilla base con diseño premium para todos los correos
 */
const baseEmailTemplate = (title, contentHtml) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; }
      .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 30px 15px; }
      .card { background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 36px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
      .brand-header { text-align: center; margin-bottom: 28px; }
      .logo-title { font-size: 24px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: -0.5px; }
      .logo-title span { color: #f59e0b; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); margin-top: 6px; }
      h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; text-align: center; }
      p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 16px; }
      .button-container { text-align: center; margin: 30px 0; }
      .btn { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff !important; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4); text-align: center; }
      .info-box { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px 20px; margin: 24px 0; }
      .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 25px; line-height: 1.5; }
      .footer a { color: #94a3b8; text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="brand-header">
          <div class="logo-title">Sorteos<span>Peru</span>.pe</div>
          <div><span class="badge">Sorteos 100% Transparentes</span></div>
        </div>
        ${contentHtml}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} SorteosPeru.pe. Todos los derechos reservados.<br>
        Recibiste este correo porque estás registrado en nuestra plataforma.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * 1. Enviar correo de recuperación de contraseña
 */
exports.sendPasswordResetEmail = async (user, resetUrl) => {
  const content = `
    <h1>🔐 Recuperación de Contraseña</h1>
    <p>Hola <strong>${user.name}</strong>,</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SorteosPeru.pe.</p>
    <p>Para ingresar una nueva contraseña, haz clic en el siguiente botón:</p>
    
    <div class="button-container">
      <a href="${resetUrl}" class="btn" target="_blank">Restablecer mi Contraseña</a>
    </div>

    <div class="info-box">
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">
        ⚠️ <strong>Este enlace es de uso único y expira en 1 hora.</strong><br>
        Si tú no solicitaste este cambio, puedes ignorar este mensaje; tu cuenta sigue completamente protegida.
      </p>
    </div>

    <p style="font-size: 12px; color: #64748b; word-break: break-all;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${resetUrl}" style="color: #818cf8;">${resetUrl}</a>
    </p>
  `;

  const html = baseEmailTemplate('Restablece tu contraseña - SorteosPeru.pe', content);
  const transporter = getTransporter();

  if (!transporter) {
    console.log('\n============================================================');
    console.log('📧 [EMAIL SIMULADO - RECUPERACIÓN DE CONTRASEÑA]');
    console.log(`Para: ${user.email} (${user.name})`);
    console.log(`Enlace de restablecimiento: ${resetUrl}`);
    console.log('Nota: Para envíos reales, configura SMTP_USER y SMTP_PASS en .env');
    console.log('============================================================\n');
    return { success: true, simulated: true, resetUrl };
  }

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"SorteosPeru.pe" <no-reply@sorteosperu.pe>',
    to: user.email,
    subject: '🔐 Restablece tu contraseña - SorteosPeru.pe',
    html
  });
};

/**
 * 2. Enviar correo al GANADOR de un sorteo
 */
exports.sendWinnerEmail = async (winnerEmail, winnerName, raffle, ticketNumber) => {
  if (!winnerEmail) return;

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 60px;">🏆</span>
    </div>
    <h1>¡FELICIDADES, ERES EL GANADOR! 🎉</h1>
    <p style="text-align: center; font-size: 17px; color: #ffffff;">
      Hola <strong>${winnerName}</strong>, ¡tenemos una maravillosa noticia para ti!
    </p>
    <p style="text-align: center;">
      Has salido ganador oficial en nuestro sorteo en vivo:
    </p>

    <div class="info-box" style="text-align: center; border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.08);">
      <h2 style="color: #fbbf24; font-size: 22px; margin: 0 0 10px 0;">${raffle.title}</h2>
      <p style="font-size: 20px; font-weight: 800; color: #10b981; margin: 5px 0;">
        Premio: S/ ${raffle.prizeValue.toFixed(2)}
      </p>
      <div style="display: inline-block; background: #7c3aed; color: #fff; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 15px; margin-top: 10px;">
        Ticket Ganador: #${ticketNumber}
      </div>
    </div>

    <p>
      Nuestro equipo se comunicará contigo vía WhatsApp o telefónica para validar tu identidad y coordinar la entrega inmediata de tu premio.
    </p>

    <div class="button-container">
      <a href="${process.env.GOOGLE_REDIRECT_ORIGIN || 'https://sorteosperu.pe'}/mis-tickets" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);" target="_blank">
        Ver Mis Tickets Ganadores
      </a>
    </div>

    <p style="text-align: center; font-size: 14px; color: #94a3b8;">
      ¡Muchas gracias por confiar y participar en SorteosPeru.pe! 🍀
    </p>
  `;

  const html = baseEmailTemplate('🏆 ¡ERES EL GANADOR! - SorteosPeru.pe', content);
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`📧 [EMAIL SIMULADO A GANADOR] Para: ${winnerEmail} | Sorteo: ${raffle.title} | Ticket: ${ticketNumber}`);
    return { success: true, simulated: true };
  }

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"SorteosPeru.pe" <no-reply@sorteosperu.pe>',
    to: winnerEmail,
    subject: `🏆 ¡FELICIDADES! Eres el Ganador de "${raffle.title}" en SorteosPeru.pe`,
    html
  });
};

/**
 * 3. Enviar correo cuando se HABILITA un nuevo sorteo
 */
exports.sendNewRaffleEmail = async (userEmail, userName, raffle) => {
  if (!userEmail) return;

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 55px;">🚀</span>
    </div>
    <h1>¡Nuevo Sorteo Habilitado! 🎁</h1>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Acabamos de habilitar un nuevo sorteo oficial para que participes:</p>

    <div class="info-box">
      <h3 style="color: #ffffff; margin-top: 0; font-size: 18px;">${raffle.title}</h3>
      <p style="color: #94a3b8; font-size: 14px; margin-bottom: 12px;">${raffle.description || '¡Gran oportunidad de ganar con SorteosPeru.pe!'}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
        <span style="color: #10b981; font-weight: bold; font-size: 16px;">Premio: S/ ${raffle.prizeValue}</span>
        <span style="color: #fbbf24; font-weight: bold; font-size: 16px;">Ticket: S/ ${raffle.ticketPrice}</span>
      </div>
    </div>

    <div class="button-container">
      <a href="${process.env.GOOGLE_REDIRECT_ORIGIN || 'https://sorteosperu.pe'}/sorteos/${raffle._id}" class="btn" target="_blank">
        Comprar Tickets Ahora
      </a>
    </div>

    <p style="text-align: center; font-size: 13px; color: #64748b;">
      Recuerda que cada ticket es verificado y participa en la ruleta transparente transmitida en vivo.
    </p>
  `;

  const html = baseEmailTemplate(`¡Nuevo Sorteo: ${raffle.title}! - SorteosPeru.pe`, content);
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`📧 [EMAIL SIMULADO NUEVO SORTEO] Para: ${userEmail} | Sorteo: ${raffle.title}`);
    return { success: true, simulated: true };
  }

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"SorteosPeru.pe" <no-reply@sorteosperu.pe>',
    to: userEmail,
    subject: `🚀 ¡Nuevo Sorteo Habilitado: ${raffle.title}! Participa en SorteosPeru.pe`,
    html
  });
};

/**
 * 4. Enviar correo de confirmación de tickets al aprobar el pago
 */
exports.sendPaymentApprovedEmail = async (userEmail, userName, raffle, ticketNumbers, amount) => {
  if (!userEmail) return;

  const ticketsFormattedHtml = (ticketNumbers || []).map(t => 
    `<span style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-family: monospace; font-size: 15px; margin: 4px; border: 1px solid rgba(255,255,255,0.2);">🎫 ${t}</span>`
  ).join(' ');

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 55px;">✅</span>
    </div>
    <h1>¡Pago Aprobado con Éxito! 🎉</h1>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Te confirmamos que tu comprobante de pago por <strong>S/ ${(amount || 0).toFixed(2)}</strong> ha sido verificado y aprobado por nuestro equipo de administración.</p>

    <div class="info-box" style="text-align: center; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
      <h3 style="color: #ffffff; margin-top: 0; font-size: 18px;">${raffle ? raffle.title : 'Sorteo'}</h3>
      <p style="color: #10b981; font-size: 18px; font-weight: 800; margin: 4px 0 14px 0;">
        Premio en Juego: S/ ${(raffle && raffle.prizeValue ? raffle.prizeValue : 0).toFixed(2)}
      </p>
      
      <p style="color: #94a3b8; font-size: 13px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Tus Tickets Oficiales Registrados:
      </p>
      <div style="margin: 10px 0;">
        ${ticketsFormattedHtml}
      </div>
    </div>

    <div class="button-container">
      <a href="${process.env.GOOGLE_REDIRECT_ORIGIN || 'https://sorteosperu.pe'}/mis-tickets" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);" target="_blank">
        Ver Mis Tickets en Mi Cuenta
      </a>
    </div>

    <div class="info-box" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.25);">
      <p style="margin: 0; font-size: 13px; color: #fbbf24;">
        🍀 <strong>¡Ya estás participando activamente!</strong><br>
        Recibirás una notificación y te llamaremos directamente a tu WhatsApp cuando se realice la transmisión en vivo del sorteo.
      </p>
    </div>
  `;

  const html = baseEmailTemplate(`✅ ¡Pago Aprobado! Tus tickets para ${raffle ? raffle.title : 'SorteosPeru.pe'}`, content);
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n============================================================`);
    console.log(`📧 [EMAIL SIMULADO - PAGO APROBADO Y TICKETS ENVIADOS]`);
    console.log(`Para: ${userEmail} (${userName})`);
    console.log(`Sorteo: ${raffle ? raffle.title : ''}`);
    console.log(`Monto: S/ ${amount} | Tickets: ${(ticketNumbers || []).join(', ')}`);
    console.log(`============================================================\n`);
    return { success: true, simulated: true };
  }

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"SorteosPeru.pe" <no-reply@sorteosperu.pe>',
    to: userEmail,
    subject: `✅ ¡Pago Aprobado! Tus tickets para "${raffle ? raffle.title : 'el sorteo'}" - SorteosPeru.pe`,
    html
  });
};
