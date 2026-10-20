const http = require('http');

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('--- TESTING ENDPOINTS & ASSETS ---');
  
  // 1. Static Bunny Mascot
  const logo = await get('/images/logo-conejo.png');
  console.log('1. /images/logo-conejo.png:', logo.statusCode, `(${logo.body.length} bytes)`);

  // 2. Login Page
  const login = await get('/login');
  console.log('2. /login status:', login.statusCode);
  console.log('   - Has logo-conejo.png:', login.body.includes('logo-conejo.png'));
  console.log('   - Has Google button container:', login.body.includes('g_id_signin'));
  console.log('   - Has togglePassword:', login.body.includes('togglePassword'));
  console.log('   - Has Register link:', login.body.includes('/register'));

  // 3. Register Page
  const register = await get('/register');
  console.log('3. /register status:', register.statusCode);
  console.log('   - Has logo-conejo.png:', register.body.includes('logo-conejo.png'));
  console.log('   - Has minlength 6 for password:', register.body.includes('minlength="6"'));
  console.log('   - Has Google register container:', register.body.includes('g_id_register'));
  console.log('   - Submit button is enabled:', !register.body.includes('id="submitBtn" disabled'));

  // 4. Perfil Route (without session -> redirects to /login)
  const perfilNoAuth = await get('/perfil');
  console.log('4. /perfil (no auth redirect):', perfilNoAuth.statusCode, '->', perfilNoAuth.headers.location);

  // 5. Check CSS Style
  const css = await get('/css/style.css');
  console.log('5. /css/style.css:', css.statusCode, `(${css.body.length} bytes)`);
  console.log('   - Has light theme data-theme="light":', css.body.includes('[data-theme="light"]'));
  console.log('   - Has btn-pwa-install:', css.body.includes('.btn-pwa-install'));

  // 6. Check Payments upload normalizer in app.js
  const uploadDouble = await get('/uploads//uploads/test.png');
  console.log('6. /uploads//uploads/test.png redirect:', uploadDouble.statusCode, '->', uploadDouble.headers.location);

  console.log('--- ALL AUTOMATED CHECKS COMPLETED ---');
  process.exit(0);
})();
