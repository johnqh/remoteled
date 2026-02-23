# Improvement Plans for remoteled

## Priority 1 - High Impact

### 1. Significantly Expand Test Coverage
- The entire backend (`backend/app/`) has only one test file: `backend/tests/test_admin_crud.py`. The 12 API route modules (`devices.py`, `orders.py`, `authorizations.py`, `payments.py`, `telemetry.py`, `admin.py`, `auth.py`, `device_models.py`, `locations.py`, `service_types.py`, `reference.py`, `led.py`) are completely untested at the unit level.
- The frontend has a single test file: `frontend/admin-react/src/pages/__tests__/Dashboard.test.tsx`. The 12+ API client modules, 6 custom hooks, and numerous components have no tests.
- Priority test targets for the backend: `app/core/auth.py` (JWT authentication), `app/core/payment_handler.py` (Stripe integration), `app/services/crypto.py` (cryptographic signature verification for device authorization), and `app/api/orders.py` (order lifecycle state machine).

### 2. Improve Error Handling in Backend API
- `app/main.py` has a global exception handler that exposes raw exception messages in debug mode (`str(exc)`) and returns a generic message otherwise. Neither approach provides structured error codes that frontend consumers can reliably handle.
- The `app/core/database.py` Database class creates a new `psycopg2` connection per request with no connection pooling. Under concurrent load, this will exhaust PostgreSQL connections. Migrating to `asyncpg` with a connection pool (or SQLAlchemy async with `create_async_engine`) would improve both performance and reliability.
- Individual API route handlers likely catch broad exceptions without distinguishing between client errors (400), not-found (404), and server errors (500). Auditing all routes for proper HTTP status code usage would improve API correctness.

### 3. Add JSDoc/Docstrings to Core Modules
- `app/core/auth.py` (JWT authentication, Firebase Auth integration) lacks docstrings explaining the authentication flow, token format, and security assumptions.
- `app/services/crypto.py` (ECDSA signature generation and verification for BLE authorization) is a security-critical module that needs thorough documentation of the signing scheme, key management, and payload format.
- `app/core/led_handler.py` (BLE communication with Raspberry Pi) needs documentation explaining the BLE protocol, GPIO pin mapping, and error recovery when the device is unreachable.
- The Pydantic models in `app/models/schemas.py` have types but no field descriptions. Adding `Field(description=...)` to all fields would auto-generate better OpenAPI documentation.

## Priority 2 - Medium Impact

### 4. Address Security Concerns
- `app/core/config.py` has `CORS_ORIGINS: str = "*"` and `API_DEBUG: bool = True` as defaults. These are appropriate for development but dangerous if deployed without overriding. Adding a production mode check or warning when these values are used in a non-development environment would prevent accidental exposure.
- The `BLE_KEY` configuration (`A920`) is a static 4-hex-digit session key. The README acknowledges this is "fine for demos, not strong security." Documenting the path to production-grade BLE authentication (e.g., per-session key rotation, challenge-response) would clarify the security roadmap.
- Stripe secret key is stored as an empty string default in config. Adding validation that rejects API startup when payment endpoints are enabled but Stripe keys are not configured would prevent silent payment failures.

### 5. Migrate Database Layer to Async
- The backend uses `psycopg2` (synchronous) with FastAPI (async framework). This forces all database operations to run synchronously, blocking the event loop. Migrating to `asyncpg` (already listed in `pyproject.toml` dependencies) or SQLAlchemy async would align the database layer with FastAPI's async architecture.
- The current `Database` class creates raw SQL queries throughout API handlers. Introducing an ORM layer (SQLAlchemy models) or at least a repository pattern would centralize data access and make queries testable.

### 6. Standardize Frontend Architecture
- The React admin frontend (`frontend/admin-react/`) has overlapping patterns: `src/context/AuthContext.tsx` and `src/contexts/AuthContext.tsx` (two directories), `src/api/` and `src/core/api/` (two API client locations), `src/hooks/` and `src/features/*/use*.ts` (two hook locations). Consolidating to a single pattern per concern would reduce confusion.
- The frontend uses plain `fetch`/`axios` calls without TanStack Query for server state management. Adding TanStack Query would provide caching, automatic refetching, and loading/error states that the current manual implementation likely handles inconsistently.

## Priority 3 - Nice to Have

### 7. Add CI/CD Pipeline
- There are no GitHub Actions workflows or CI configuration. Adding a basic pipeline that runs backend tests (`pytest`), frontend tests (`vitest`), linting, and type checking on pull requests would catch regressions before merge.
- The Docker Compose setup (`docker-compose.yml`) only covers Pi deployment (IoT peripheral + web kiosk). Adding a `docker-compose.dev.yml` for local development that includes the backend, PostgreSQL, and admin frontend would simplify onboarding.

### 8. Improve Docker Configuration
- `docker-compose.yml` uses `privileged: true` and raw device mounts (`/dev/gpiomem`, `/dev/mem`) for the IoT peripheral. Documenting the minimum required Linux capabilities (instead of full privileged mode) would improve container security.
- There are four Dockerfiles (`Dockerfile.backend`, `Dockerfile.frontend`, `Dockerfile.frontend.react`, `Dockerfile.iot`, `Dockerfile.web`) but no documentation explaining which combinations are used for which deployment scenarios.

### 9. Add API Versioning
- The backend API has no versioning. All routes are at the root path (`/api/devices`, `/api/orders`, etc.). Adding API version prefixes (`/api/v1/`) now, while the project is young, would prevent breaking changes for Android app clients when the API evolves.
