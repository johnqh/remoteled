# RemoteLED

QR-to-device payment activation system. Customers scan a QR code on a Raspberry Pi kiosk, select a service (laundry, vending, air compressor), pay via Stripe, and the Pi activates a GPIO relay for the authorized duration. The backend signs ECDSA authorizations; the Android app relays them to the Pi over BLE.

## Monorepo Structure

```
backend/             Python FastAPI API server (port 9999)
  app/
    api/             Route modules: admin, auth, authorizations, devices, led, orders, payments, reference, telemetry
    core/            Config, database, auth, LED handler, payment handler, validators, admin logger
    models/          Pydantic request/response schemas
    services/        ECDSA crypto signing
frontend/
  admin-react/       React 18 + TypeScript + Vite admin console (port 5173)
    src/
      core/          API client (Axios), TypeScript types, utils — PRIMARY shared code
      contexts/      AuthContext (localStorage JWT)
      features/      Feature modules: auth, dashboard, devices, orders, products
      components/    Shared UI (Badge, Button, Modal, forms, layout)
      pages/         Route pages (Dashboard, Login)
      hooks/         Data hooks (legacy — prefer features/*/use*.ts)
      api/           Fetch-based client (legacy — prefer core/api/client.ts)
database/            PostgreSQL schema, seed data, migrations
pi/                  Raspberry Pi BLE peripheral (Python/Node) + kiosk
android/             Kotlin Android app (BLE GATT + QR scanner)
tests/               Shell-script integration tests
docs/                Architecture docs
plans/               Improvement plans
```

## Tech Stack

| Component | Stack |
|-----------|-------|
| Backend | Python 3.11+, FastAPI, psycopg2 (sync), Pydantic, Stripe, ECDSA (secp256k1), Bleak (BLE) |
| Frontend | React 18, TypeScript 5.5, Vite 5, Tailwind CSS, Recharts, Axios, React Router 6 |
| Database | PostgreSQL 15+, raw SQL with RealDictCursor (no ORM) |
| Pi | Python (bluezero/bleak) or Node.js BLE peripheral, nginx kiosk |
| Android | Kotlin, BLE GATT, CameraX + ML Kit QR, minSdk 34 |
| Packages | uv (Python), npm (Node), Gradle (Android) |

## Key Commands

```bash
# Backend
cd backend && uv run --no-project uvicorn app.main:app --reload --host 0.0.0.0 --port 9999
# Swagger docs: http://localhost:9999/docs

# Frontend
cd frontend/admin-react && npm run dev    # http://localhost:5173/admin/
cd frontend/admin-react && npm run test   # vitest

# Database
createdb remoteled
psql -d remoteled -f database/schema.sql
psql -d remoteled -f database/seed.sql

# Docker (full admin stack)
docker compose -f docker-compose.admin.yml up

# Makefile shortcuts
make dev-backend      # start FastAPI
make dev-frontend     # start Vite
make test             # run all tests
make db-reset         # drop + recreate + seed
make install          # uv sync + npm install
```

## Database Schema

### Enums
- `service_type`: TRIGGER | FIXED | VARIABLE
- `order_status`: CREATED -> PAID -> RUNNING -> DONE (or FAILED at any step)
- `device_status`: ACTIVE | OFFLINE | MAINTENANCE | DEACTIVATED
- `log_direction`: PI_TO_SRV | SRV_TO_PI

### Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| admins | Admin users | email, password_hash, role |
| devices | Pi devices | label, public_key, model_id FK, location_id FK, gpio_pin, status |
| device_models | Reference: hardware models | name |
| locations | Reference: physical locations | name |
| service_types | Reference: enum labels | name, code (service_type enum) |
| services | Products/pricing | type, price_cents, fixed_minutes, minutes_per_25c, active |
| device_services | M2M: device <-> service | device_id FK, service_id FK (unique pair) |
| orders | Customer orders | device_id FK, service_id FK, amount_cents, authorized_minutes, status |
| authorizations | Signed payloads | order_id FK (unique), device_id FK, payload_json, signature_hex, expires_at |
| logs | Device telemetry | device_id FK, direction, ok, details |
| admin_logs | Audit trail | admin_id FK, action, entity_type, entity_id |

### Views
- `v_devices_summary` — devices with service counts and order stats
- `v_orders_detailed` — orders joined with device/service info
- `v_logs_recent` — last 100 logs with device labels

### Functions
- `get_device_services(device_uuid)` — active services for a device
- `calculate_variable_minutes(service_uuid, amount_cents)` — compute authorized time

## API Route Structure

| Prefix | Module | Auth | Purpose |
|--------|--------|------|---------|
| /auth | auth.py | No | Register, login, logout, me |
| /devices | devices.py | No | Public device + service lookup |
| /orders | orders.py | No | Order CRUD + status transitions |
| /authorizations | authorizations.py | No | ECDSA authorization create/read |
| /payments | payments.py | No | Stripe payment + LED trigger |
| /led | led.py | No | Direct BLE LED control |
| /admin | admin.py | JWT | Stats, device/service/order CRUD, logs |
| /admin | reference.py | JWT | Device models, locations, service types CRUD |
| /devices | telemetry.py | No | Device event logging |

## Architecture Patterns

### Backend
- **Database**: global `db` singleton (`app/core/database.py`); `get_db()` yields a psycopg2 `RealDictCursor` via FastAPI `Depends()`. Connection auto-commits on exit, rollbacks on exception.
- **SQL**: raw SQL everywhere with `%s` parameterization. Results are dicts. No ORM.
- **Auth**: JWT via python-jose (HS256), bcrypt passwords. `Depends(get_current_user)` for protected endpoints. Token in `Authorization: Bearer <token>`.
- **Validation**: Pydantic models for request/response. UUID validation via `app/core/validators.py`.
- **Admin logging**: `log_admin_action()` uses its own DB connection (won't fail main transaction).
- **Crypto**: ECDSA secp256k1 signing in `app/services/crypto.py`.
- **BLE**: Bleak library for macOS/Linux BLE communication in `app/core/led_handler.py`.

### Frontend
- **API client**: `src/core/api/client.ts` (Axios) is primary. Auto-detects dev (localhost:9999) vs prod (/api proxy). Request interceptor adds Bearer token from localStorage.
- **Auth**: `src/contexts/AuthContext.tsx`. Token in localStorage as `access_token`.
- **Hooks**: feature hooks in `src/features/*/use*.ts` (primary) follow useState + useCallback + try/catch pattern.
- **Routing**: React Router 6. Base path `/admin/`. Vite proxy: `/api` -> `http://localhost:9999`.
- **Styling**: Tailwind CSS only (no CSS modules).

## Common Pitfalls

- **Port 9999**: Backend runs on 9999 locally. Docker compose uses 8000. Do NOT hardcode ports in frontend — use the API client.
- **No ORM**: Database is raw psycopg2. Do not introduce async DB calls (asyncpg) or SQLAlchemy without migrating everything.
- **Dual frontend paths**: `src/core/` + `src/features/` is primary. `src/api/` + `src/hooks/` is legacy. Add new code to the primary path.
- **Firebase is dead**: Still in pyproject.toml deps but NOT used. Auth was migrated to local JWT. Do not re-add Firebase auth.
- **Service type constraints**: TRIGGER must not have fixed_minutes/minutes_per_25c. FIXED requires fixed_minutes. VARIABLE requires minutes_per_25c. Enforced at both DB and API level.
- **Order status transitions**: Strictly validated via `valid_transitions` dict in `orders.py`. Cannot skip states.
- **UUID validation**: All IDs are UUID v4. Use `validate_uuid()` from `app/core/validators.py`.
- **Admin logger**: Opens its own DB connection (separate from request cursor). This is intentional.
- **Connection per request**: psycopg2 creates a new connection per request (no pool). This is a known limitation.

## Environment Setup

```bash
# Prerequisites: Python 3.11+, Node.js 18+, PostgreSQL 15+, uv

# Install dependencies
uv sync                                    # Python
cd frontend/admin-react && npm install     # Frontend

# Database
createdb remoteled
psql -d remoteled -f database/schema.sql
psql -d remoteled -f database/seed.sql

# Configure backend
cp backend/.env.example backend/.env       # Edit with your Stripe keys if needed

# Run
cd backend && uv run --no-project uvicorn app.main:app --reload --host 0.0.0.0 --port 9999
cd frontend/admin-react && npm run dev
```
