# El Trébol — Backend (API Laravel)

API del sistema de apuestas de taquilla. La documentación completa del proyecto (roles, ciclo de vida de los tickets, liquidación, analíticas y endpoints) está en el [README raíz](../README.md).

## Puesta en marcha

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
# Configurar DB_* y SPORTS_API_KEY en .env
php artisan migrate
php artisan db:seed
php artisan serve
```

La API queda en `http://localhost:8000/api`.

## Estructura

```
app/
├── Console/Commands/    fetch:animalitos (resultados de loterías)
├── Http/Controllers/    Un controller por recurso
├── Http/Middleware/     admin, supervisor, taquilla
├── Models/              Ticket, TicketSelection, TicketMovement, ...
└── Services/            Liquidación deportiva, analíticas, movimientos
config/sports.php        Hosts y mercados de la API deportiva
database/migrations/     Esquema
tests/Feature/           Tests de API
```

## Comandos útiles

```bash
php artisan test                        # Suite completa (SQLite en memoria)
php artisan migrate --force             # Aplicar migraciones
php artisan fetch:animalitos           # Sincronizar resultados de loterías
php artisan schedule:run                # Ejecutar el planificador (cron)
```

El planificador (`app/Console/Kernel.php`) ejecuta `fetch:animalitos` cada 10 minutos entre las 09:00 y las 19:00. Para que funcione hay que instalarlo con cron:

```
* * * * * cd /ruta/al/backend && php artisan schedule:run >> /dev/null 2>&1
```

## Notas de implementación

- **Liquidez de parley**: `app/Services/SportsSettlementService.php` resuelve cada pierna contra el resultado oficial. Lo que no puede determinar con certeza pasa a `review` y lo decide el supervisor; nunca se paga solo.
- **Sorteo aplicable**: en animalitos, el sorteo que valida un ticket es el primero **resuelto** posterior a su emisión (`is_resolved` descarta los placeholders).
- **Aislamiento**: las consultas se filtran siempre por `agency_id`, `supervisor_id` o `taquilla_id` según el rol.
