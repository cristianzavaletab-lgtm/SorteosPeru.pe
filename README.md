# SorteosPeru.pe

Plataforma de sorteos transparentes con pagos por Yape/Plin.

## Desarrollo local

1. Copia `.env.example` como `.env` y completa los valores.
2. Instala las dependencias con `npm install`.
3. Inicia la aplicación con `npm run dev`.

## Deploy en Render

El repositorio incluye `render.yaml` con la configuración base del servicio.

- Rama: `main`
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check: `/health`

Agrega en Render todas las variables declaradas en `.env.example`. No agregues
`PORT`: Render la asigna automáticamente.

Para crear o actualizar el administrador, define temporalmente `ADMIN_NAME`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_PHONE`, abre la Shell de Render y ejecuta:

```bash
npm run seed
```

Después elimina `ADMIN_PASSWORD` del entorno de Render.

## Comandos

```bash
npm run dev
npm start
npm run seed
```
