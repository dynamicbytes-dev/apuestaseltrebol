# El Trébol — Sistema de apuestas de taquilla

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

## Puesta en marcha

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
# Configurar las variables DB_* y SPORTS_API_KEY en .env
php artisan migrate
php artisan db:seed
php artisan serve
```

API disponible en `http://localhost:8000/api`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` e iniciar sesión con el usuario administrador.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `DB_*` | Conexión a PostgreSQL (`pgsql`, `127.0.0.1:5432`, base `eltrebol`) |
| `APP_TIMEZONE` | Zona horaria de la operación. Por defecto `America/Caracas`: los horarios de sorteo y las fechas de los tickets se registran en hora local |
| `JWT_SECRET` | Secreto de firma de los tokens (`php artisan jwt:secret`) |
| `JWT_TTL` | Duración de la sesión **en minutos**. El valor por defecto es 60 |
| `SPORTS_API_KEY` | Clave de API-SPORTS. Nunca se expone al frontend |
| `SPORTS_API_TIMEOUT` | Tiempo máximo de espera por consulta, en segundos |

### Usuario administrador

El seeder crea **únicamente** el usuario administrador (sin datos demo):

| Rol | Email | Password |
|---|---|---|
| Administrador | `rosangeles92@gmail.com` | `password` |

El administrador registra agencias y supervisores. Cada supervisor inicia sesión en su propio panel y registra las taquillas de su agencia.

### Configuración inicial de una lotería

Una lotería nueva recibe por defecto el horario de juego de 8:00 a 19:00. Ajústalo desde *Loterías → detalle* si esa lotería juega a otras horas.

## Roles y aislamiento

- **administrador**: acceso global (registro de agencias, supervisores, configuración, analítica consolidada).
- **supervisor**: asignado a una agencia; registra y gestiona taquillas de su agencia, revisa jugadas ambiguas y consulta la analítica y el historial de su agencia.
- **taquilla**: asociada a una agencia y a su supervisor; registra, cobra y anula tickets.

El aislamiento se aplica siempre por `agency_id` / `supervisor_id` / `taquilla_id`: un supervisor solo ve los tickets de su agencia y una taquilla solo ve los suyos.

## Ciclo de vida de un ticket

```
Emisión (taquilla)  →  pendiente  →  liquidación contra el resultado oficial  →  pagado
                                          │
                                          ├─ animalitos: el sorteo que declara la apuesta
                                          ├─ hipismo:    ganador oficial de la carrera
                                          └─ parley:     resultado oficial de cada pierna
                                                │
                                                └─ si el mercado no se puede liquidar → revisión del supervisor
```

- **Emisión**: la taquilla elige modalidad y monto. En animalitos elige lotería, sorteo y uno o varios animalitos con su monto. El backend valida los topes de la agencia (`max_bet_amount`, `max_ticket_payout`), calcula la cuota y el premio potencial, y guarda el ticket y sus selecciones en una transacción.
- **Liquidación**: antes de pagar, el backend comprueba el resultado oficial. **Ninguna jugada se paga sin verificar.**
- **Pago**: solo se permite si la liquidación resulta ganadora, y nunca por más de lo que corresponde.
- **Anulación**: únicamente dentro de los **5 minutos** posteriores a la emisión.

### Liquidación automática (parley)

El motor de liquidación (`app/Services/SportsSettlementService.php`) consulta el resultado oficial del evento en el proveedor deportivo y resuelve cada pierna:

| Mercado | Regla |
|---|---|
| Ganador del partido (1X2 / moneyline) | Compara marcadores, por signo (Local/Visitante/Empate) o por nombre de equipo |
| Doble oportunidad | "Local o Empate", "Empate o Visitante", "Local o Visitante" |
| Total de goles (Over/Under) | Total del partido frente al umbral del mercado |
| Ambos equipos marcan | Ambos con al menos un gol |

**Todo lo demás va a revisión manual.** Un mercado no reconocido, un evento sin resultado oficial, un partido aplazado o cancelado, o un evento que el proveedor ya no devuelve dejan el ticket en estado `review`: nunca se paga de forma automática. Es preferible escalar a revisión antes que pagar un ticket perdedor.

El supervisor resuelve los casos en revisión desde `POST /api/supervisor/tickets/{ticket}/review`. Su decisión tiene prioridad y el motor automático no la sobrescribe.

### Apuestas de animalitos

Una apuesta de animalitos declara **a qué sorteo pertenece** y puede llevar **varios animalitos, cada uno con su monto**:

```
Lotería: Lotto Activo
Sorteo:  29/10 19:00
Jugadas: N° 5 - León    → 50.00
         N° 12 - Caballo → 30.00
Total:   80.00          Premio potencial: 2.400,00
```

- Los **horarios de sorteo** se configuran por lotería (panel de Loterías → detalle). Son las únicas horas que la taquilla puede elegir. Sin horarios, la lotería no admite apuestas.
  - Horario de juego por defecto: **de 8:00 a 19:00 en punto** (doce horarios, con 12:00 al mediodía). Se asigna automáticamente a las loterías nuevas y se puede ajustar por lotería.
  - El panel de resultados del administrador ofrece los mismos horarios, para que el resultado se registre a la hora exacta del sorteo.
- El **total es la suma de los montos**, y lo calcula el backend: el cliente nunca fija el monto.
- Al cobrar, solo pagan **las piernas ganadoras**: si salió el N° 5, se pagan `50 × multiplicador` y el N° 12 no paga nada. Si no gana ninguna, el ticket no se paga.
- La validación busca **exactamente el sorteo que declara el ticket**. Una apuesta de las 19:00 nunca se liquidará contra el resultado del sorteo de las 09:00.
- No se puede apostar a un sorteo que ya pasó ni a uno que ya tiene resultado oficial registrado.

### Hipismo y parley

Se mantienen como estaban: una sola selección por ticket, todo o nada.

- **Hipismo**: se compara el ejemplar jugado contra el ganador oficial de la carrera. Si la carrera no está finalizada, no se puede cobrar.
- **Parley**: cada pierna se liquida contra el resultado oficial del evento (ganador 1X2, doble oportunidad, total de goles y ambos equipos marcan). Todo lo demás pasa a revisión manual del supervisor, que decide con `POST /api/supervisor/tickets/{ticket}/review`.

## Analíticas e historial

- `GET /api/supervisor/analytics` — métricas de la agencia del supervisor.
- `GET /api/admin/analytics` — consolidado global con desglose por agencia.

Ambos aceptan `?from=AAAA-MM-DD&to=AAAA-MM-DD` (por defecto, los últimos 30 días) y devuelven: tickets emitidos, total apostado, total pagado, resultado (apostado − pagado), exposición pendiente, desglose por tipo de juego, por estado, serie diaria y estadísticas de liquidación del parley.

El historial de movimientos (`ticket_movements`) registra cada emisión, pago, anulación y cambio de liquidación con su autor, estado origen/destino, monto y nota.

## Resultados de animalitos

Los resultados se registran en `animalito_sorteos`. El comando programado `fetch:animalitos` (cada 10 minutos, entre las 09:00 y las 19:00) consulta la fuente de cada lotería.

La tarea se define en `backend/routes/console.php`. En Laravel 11 y 12 el planificador ya no lee `app/Console/Kernel.php`, así que una tarea definida ahí **nunca se ejecuta**.

```bash
# Instalar el planificador (una sola vez)
* * * * * cd /ruta/al/backend && /ruta/al/php artisan schedule:run >> /dev/null 2>&1
```

- Si la lotería **no tiene** `source_url` configurada, el comando no consulta ninguna fuente y el resultado queda pendiente de ingreso manual por el administrador. No se crea ninguna fila.
- El número se conserva como texto: `"00"` y `"0"` son números distintos.
- La idempotencia está acotada por fecha: un mismo número puede salir en sorteos de días diferentes.
- El panel de Loterías avisa qué loterías siguen **sin resultado** para la fecha consultada: sin un resultado oficial no se pueden cobrar los tickets de esas loterías.

El administrador registra los resultados manualmente desde el panel de Loterías.

## API deportiva (Parley)

La integración usa la misma clave para todos los deportes, configurada solo en el backend:

| Variable | Descripción |
|---|---|
| `SPORTS_API_KEY` | Clave de API-SPORTS (nunca se expone al frontend) |
| `SPORTS_API_TIMEOUT` | Tiempo máximo de espera por consulta (segundos) |

Hosts configurados en `backend/config/sports.php`: fútbol (`v3.football`), béisbol (`v1.baseball`), baloncesto (`v1.basketball`), hockey (`v1.hockey`) y NBA (`v2.nba`). Las respuestas de eventos, cuotas y resultados se almacenan en caché para proteger el límite diario del plan.

## Sesión

La sesión usa tokens JWT. La duración se toma de `JWT_TTL` (en minutos, por defecto 60) y **el frontend renueva el token automáticamente** poco antes de que caduque, de modo que la sesión se mantiene activa mientras el operador trabaja. El temporizador del panel muestra el tiempo restante y permite renovar manualmente.

`POST /api/auth/refresh` renueva el token vigente. Un token ya expirado no se puede renovar: hay que iniciar sesión de nuevo.

## Endpoints

### Público

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicia sesión y devuelve el token |

### Autenticado (cualquier rol)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/logout` | Cierra la sesión |
| `POST` | `/api/auth/refresh` | Renueva el token |
| `GET` | `/api/auth/me` | Datos del usuario en sesión |
| `GET` | `/api/parley/sports` | Deportes disponibles |
| `GET` | `/api/parley/events` | Eventos por deporte y fecha |
| `GET` | `/api/parley/events/{sport}/{eventId}/odds` | Cuotas de un evento |

### Administrador (`/api/admin`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` `POST` | `/agencies` | Listar y registrar agencias |
| `PUT` `DELETE` | `/agencies/{agency}` | Editar y eliminar agencia |
| `PATCH` | `/agencies/{agency}/limits` | Topes por agencia |
| `GET` `POST` | `/supervisors` | Listar y registrar supervisores |
| `PUT` `DELETE` | `/supervisors/{supervisor}` | Editar y eliminar supervisor |
| `GET` `POST` | `/lotteries` | Listar y registrar loterías |
| `GET` `PUT` `DELETE` | `/lotteries/{lottery}` | Detalle, edición y borrado |
| `PUT` | `/lotteries/{lottery}/animals` | Animalitos: renombrar y habilitar |
| `GET` `POST` | `/animalitos/sorteos` | Resultados de animalitos |
| `DELETE` | `/animalitos/sorteos/{sorteo}` | Eliminar un resultado |
| `GET` `POST` | `/races` | Carreras |
| `GET` `PUT` `DELETE` | `/races/{race}` | Detalle, edición y borrado |
| `PUT` | `/races/{race}/result` | Resultado oficial (podio) |
| `POST` | `/races/{race}/horses` | Ejemplares de una carrera |
| `PUT` `DELETE` | `/races/{race}/horses/{horse}` | Editar y eliminar ejemplar |
| `PATCH` | `/races/{race}/horses/{horse}/retire` | Retirar o reactivar ejemplar |
| `GET` | `/parley/status` | Estado de la cuota del plan |
| `GET` | `/analytics` | Analítica global con desglose por agencia |

### Supervisor (`/api/supervisor`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/dashboard` | Panel del supervisor |
| `GET` | `/analytics` | Analítica de su agencia |
| `GET` `POST` | `/taquillas` | Taquillas de su agencia |
| `PUT` `DELETE` | `/taquillas/{taquilla}` | Editar y eliminar taquilla |
| `GET` | `/tickets` | Tickets de su agencia (filtros) |
| `GET` | `/tickets/{ticket}/movements` | Historial de movimientos |
| `POST` | `/tickets/{ticket}/review` | Resolver una jugada en revisión |

### Taquilla (`/api/taquilla`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/dashboard` | Panel de la taquilla |
| `GET` | `/catalog` | Catálogo de loterías, carreras y topes |
| `GET` `POST` | `/tickets` | Listar y emitir tickets |
| `GET` | `/tickets/{ticket}/settlement` | Vista previa de la liquidación: si se puede pagar, por cuánto y qué piernas ganaron |
| `POST` | `/tickets/{ticket}/pay` | Validar y pagar |
| `POST` | `/tickets/{ticket}/cancel` | Anular (5 minutos) |
| `GET` | `/tickets/{ticket}/movements` | Historial de movimientos |

## Tests

```bash
cd backend
php artisan test
```

La suite corre contra SQLite en memoria, no toca la base de datos de desarrollo y cubre la liquidación de parley, la selección del sorteo de animalitos, la apuesta multi-animalito, el pago por pierna, el comando de sorteos, el historial de movimientos, las analíticas y la gestión de sesión.

Las variables que la suite necesita (`APP_KEY`, `JWT_SECRET`, `SPORTS_API_KEY`) están fijadas en `backend/phpunit.xml`, así que **no hace falta un `.env`** para ejecutarla.

```bash
cd frontend
npm run lint
npm run build
```

## Flujo de trabajo

Ramas y ciclo de entrega:

| Rama | Uso |
|---|---|
| `main` | Producción. Solo recibe merges de `develop` mediante PR |
| `develop` | Integración. Todo el trabajo diario entra aquí |
| `feature/*` | Rama de trabajo, creada desde `develop` |

```bash
# Trabajo nuevo
git checkout develop && git pull
git checkout -b feature/mi-cambio
# ... trabajar ...
git commit -am "feat: ..."
git push -u origin feature/mi-cambio
# Abrir PR hacia develop

# Release
# Abrir PR de develop hacia main, esperar la CI y fusionar
```

La CI (`.github/workflows/ci.yml`) corre en cada push y en cada PR contra `main` y `develop`: tests de PHPUnit y verificación de formato con Pint en el backend, lint y compilación en el frontend.

**Protección de ramas recomendada** (en *Settings → Branches* de GitHub):

- `main`: requiere PR, no permite push directo, exige que la CI pase.
- `develop`: requiere PR, no permite push directo, exige que la CI pase.

## Estado actual

- [x] Esqueleto backend: JWT, roles, agencias y jerarquía supervisor/taquilla
- [x] Login y paneles por rol
- [x] CRUD de agencias y supervisores (registro y asignación a agencia)
- [x] Configuración de topes por agencia (monto máximo por apuesta y ganancia máxima por ticket)
- [x] Loterías / animalitos (36 números con animales, habilitar/inhabilitar y editar nombres)
- [x] Hipismo (carreras, caballos, dividendos y resultados)
- [x] Parley deportivo (integración con API externa)
- [x] Panel del supervisor (registro de taquillas)
- [x] Registro de apuestas y pagos
- [x] Validación automática de ganadores en hipismo, animalitos y parley
- [x] Apuesta de animalitos con varios animalitos y monto por cada uno
- [x] Sorteo declarado por la apuesta y pago por pierna ganadora
- [x] Flujo de revisión manual para jugadas que no se pueden liquidar solas
- [x] Analíticas por agencia e historial de movimientos
- [x] Sesión configurable con renovación automática
- [x] Planificador operativo (sincronización de resultados de loterías)
- [x] Zona horaria de la operación en hora de Caracas
