# El Trébol — Frontend (SPA React)

Interfaz del sistema de apuestas de taquilla. La documentación completa del proyecto está en el [README raíz](../README.md).

## Puesta en marcha

```bash
npm install
npm run dev
```

La SPA queda en `http://localhost:5173` y consume la API en `http://127.0.0.1:8000/api` (configurable con `VITE_API_URL`).

## Scripts

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Compilación de producción en dist/
npm run preview   # Previsualizar la compilación
npm run lint      # oxlint
```

## Estructura

```
src/
├── api/client.js      Cliente Axios: token, renovación de sesión, manejo de 401
├── components/        ThemeToggle, SessionTimer, ErrorBoundary
├── contexts/          ThemeContext (claro/oscuro)
├── layouts/           Un layout por rol: Admin, Supervisor, Taquilla
├── pages/             Una página por módulo
├── styles/            admin.css
└── utils/             session, tickets, parley, animalitos, roles, errors
```

## Sesión

`src/utils/session.js` centraliza el manejo de la sesión:

- El plazo real se lee del claim `exp` del token: el cliente no lo inventa.
- `refreshSession()` renueva el token vía `POST /api/auth/refresh` y reutiliza la misma promesa si hay varias llamadas simultáneas.
- `src/api/client.js` renueva automáticamente antes de que caduque y reintenta una vez la petición que falló con 401.

## Rutas por rol

| Ruta | Rol |
|---|---|
| `/dashboard`, `/agencies`, `/supervisors`, `/lotteries`, `/races`, `/parley`, `/limits`, `/analiticas` | administrador |
| `/supervisor`, `/supervisor/taquillas`, `/supervisor/historial`, `/supervisor/analiticas` | supervisor |
| `/taquilla`, `/taquilla/nueva`, `/taquilla/tickets` | taquilla |
