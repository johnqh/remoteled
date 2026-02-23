# Backend — FastAPI API

## Running

```bash
cd backend
uv run --no-project uvicorn app.main:app --reload --host 0.0.0.0 --port 9999
# Swagger: http://localhost:9999/docs
# Health:  http://localhost:9999/health
```

## Project Structure

```
app/
  main.py              FastAPI app, CORS, router registration, health check
  api/                 Route modules (each has its own APIRouter)
    admin.py           Admin CRUD: devices, services, assignments, stats, logs (/admin)
    auth.py            JWT auth: register, login, logout, me (/auth)
    authorizations.py  ECDSA authorization creation (/authorizations)
    devices.py         Public device endpoints (/devices)
    led.py             BLE LED control (/led)
    orders.py          Order lifecycle (/orders)
    payments.py        Stripe payment endpoints (/payments)
    reference.py       Unified reference CRUD: device-models, locations, service-types (/admin)
    telemetry.py       Device telemetry logging (/devices)
  core/
    config.py          Pydantic Settings — all env vars
    database.py        psycopg2 connection manager, get_db() FastAPI dependency
    auth.py            JWT create/verify, bcrypt, get_current_user dependency
    led_handler.py     BLE communication with Pi via Bleak
    payment_handler.py Stripe SDK wrapper
    validators.py      UUID and input validation helpers
    admin_logger.py    Audit logging (uses its own DB connection)
  models/
    schemas.py         Pydantic request/response models, enum definitions
  services/
    crypto.py          ECDSA signing (secp256k1 curve)
```

## Adding a New Endpoint

1. Pick a route module in `app/api/` (or create a new one)
2. Define Pydantic models (in the route file for one-offs, or `models/schemas.py` for shared)
3. Create the route function:
   ```python
   @router.post("/things", status_code=201, tags=["things"])
   def create_thing(
       request: ThingCreateRequest,
       cursor: RealDictCursor = Depends(get_db),           # DB access
       current_user: dict = Depends(get_current_user),      # Auth (omit for public)
   ):
   ```
4. Use raw SQL with `%s` parameterization:
   ```python
   cursor.execute("INSERT INTO things (name) VALUES (%s) RETURNING *", (request.name,))
   row = cursor.fetchone()
   cursor.connection.commit()
   return dict(row)
   ```
5. Register the router in `main.py`: `app.include_router(module.router)`
6. Log admin actions: `log_admin_action(admin_email=current_user["email"], action="CREATE_THING", ...)`

## Database Access

```python
# Read
cursor.execute("SELECT * FROM things WHERE id = %s", (thing_id,))
row = cursor.fetchone()      # dict or None (RealDictCursor)
rows = cursor.fetchall()     # list of dicts

# Write (commit explicitly after mutations)
cursor.execute("INSERT INTO things (...) VALUES (%s) RETURNING *", (val,))
new_row = cursor.fetchone()
cursor.connection.commit()

# Error handling
try:
    cursor.execute(...)
    cursor.connection.commit()
except Exception as e:
    cursor.connection.rollback()
    raise HTTPException(status_code=400, detail=str(e))
```

The `get_db()` context manager auto-commits on clean exit and rollbacks on exception. For multi-step operations, commit explicitly between steps.

## Auth

- Public endpoints: no auth dependency
- Protected: `current_user: dict = Depends(get_current_user)` — returns `{id, email, role}`
- Optional: `current_user = Depends(get_current_user_optional)` — returns dict or None
- JWT: HS256, 7-day expiry, `Authorization: Bearer <token>` header

## Conventions

- Router prefix = resource name: `prefix="/devices"`, `prefix="/admin"`
- Tags group Swagger docs: `tags=["devices"]`
- 201 for creation, 200 for read/update, 204 for delete
- Validate UUIDs early: `validate_uuid(device_id, "Device ID")`
- Dynamic UPDATE: build `updates[]` and `params[]` lists, join with commas
- Delete guards: check for referencing orders before deleting devices/services
- Always use `HTTPException` for errors, not raw exceptions

## Environment Variables

See `backend/.env.example` for all variables with descriptions. Key ones:
- `DATABASE_URL` — PostgreSQL connection string
- `API_PORT` — default 9999
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — Stripe test keys
- `ENABLE_MOCK_PAYMENT` — allow mock payment endpoint (default true)
- `BLE_SERVICE_UUID` / `BLE_CHAR_UUID` / `BLE_KEY` — must match Pi config
