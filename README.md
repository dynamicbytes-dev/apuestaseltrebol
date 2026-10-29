# El Trebol — Sistema de apuestas de taquilla

Sistema web multiagencia para la gestión de apuestas de taquilla: **animalitos**, **parley deportivo** e **hipismo**.

## Stack

- **Backend**: Laravel 12 + PostgreSQL + JWT (`tymon/jwt-auth`)
- **Frontend**: React 19 + Vite + React Router + Axios

## Estructura

```
backend/   API Laravel
frontend/  SPA React
```

## Requisitos

- PHP 8.2+
- Composer
- Node 20+
- PostgreSQL

## Backend

```bash
cd backend
composer install
php artisan key:generate
php artisan jwt:secret
# Configurar las variables DB_* en .env
php artisan migrate
php artisan db:seed
php artisan serve
```

API disponible en `http://localhost:8000/api`.

### Base de datos

Configuración actual en `backend/.env`:

| Variable | Valor |
|---|---|
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `eltrebol` |
| `DB_USERNAME` | `postgres` |

### API deportiva (Parley)

La integración usa la misma clave para todos los deportes, configurada solo en el backend:

| Variable | Descripción |
|---|---|
| `SPORTS_API_KEY` | Clave de API-SPORTS (nunca se expone al frontend) |
| `SPORTS_API_TIMEOUT` | Tiempo máximo de espera por consulta (segundos) |

Hosts configurados en `backend/config/sports.php`: fútbol (`v3.football`), béisbol (`v1.baseball`), baloncesto (`v1.basketball`), hockey (`v1.hockey`) y NBA (`v2.nba`). Las respuestas de eventos y cuotas se almacenan en caché para proteger el límite diario del plan.

### Usuario administrador

El seeder crea **únicamente** el usuario administrador (sin datos demo):

| Rol | Email | Password |
|---|---|---|
| Administrador | `rosangeles92@gmail.com` | `password` |

El administrador registra agencias y supervisores. Cada supervisor inicia sesión en su propio panel y registra las taquillas de su agencia.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` e iniciar sesión con el usuario administrador.

## Roles y aislamiento

- **administrador**: acceso global (registro de agencias, supervisores, configuración).
- **supervisor**: asignado a una agencia; registra y gestiona taquillas de su agencia.
- **taquilla**: asociado a una agencia y a su supervisor; registra apuestas.

## Estado actual

- [x] Esqueleto backend: JWT, roles, agencias y jerarquía supervisor/taquilla
- [x] Login + panel básico del administrador
- [x] CRUD de agencias y supervisores (registro y asignación a agencia)
- [x] Configuración de topes por agencia (monto máximo por apuesta y ganancia máxima por ticket)
- [x] Loterías / animalitos (36 números con animales, habilitar/inhabilitar y editar nombres)
- [x] Hipismo (carreras, caballos, dividendos y resultados)
- [x] Parley deportivo (integración con API externa)
- [x] Panel del supervisor (registro de taquillas)
- [ ] Registro de apuestas y pagos
- [ ] Analíticas por agencia e historial de movimientos
