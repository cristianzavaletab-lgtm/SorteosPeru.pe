# 🎰 SorteosPeru.pe

Plataforma de sorteos transparentes con pagos por Yape/Plin.

## Deploy en Render

### 1. Crear Web Service en Render
- Ve a [render.com](https://render.com) → New → Web Service
- Conecta tu repositorio de GitHub
- Configuración:
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`

### 2. Variables de Entorno (Environment)
Agrega estas variables en Render → Environment:

```
MONGODB_URI=mongodb+srv://zavaletacristian77_db_user:KbI0dhgCDjCVbYoR@sorteos.znxecbn.mongodb.net/sorteos_peru?retryWrites=true&w=majority&appName=Sorteos
JWT_SECRET=super_secret_jwt_key_12345
SESSION_SECRET=super_secret_session_key_12345
PORT=3000
```

### 3. Crear Admin (una sola vez)
Después del primer deploy, abre la **Shell** de Render y ejecuta:
```bash
node seed-admin.js
```
Esto crea el usuario admin:
- **Email**: admin@sorteosperu.pe
- **User**: CRISTIANZB
- **Pass**: 60253405CZB

### 4. ¡Listo!
Tu app estará en: `https://tu-app.onrender.com`

## Comandos Locales
```bash
npm run dev      # Desarrollo con hot-reload
npm start        # Producción
npm run seed     # Crear admin
```
