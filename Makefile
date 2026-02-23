.PHONY: help build app-up app-down logs logs-iot logs-web clean \
       dev-backend dev-frontend test-backend test-frontend test \
       db-setup db-reset db-seed install admin-up admin-down

PLATFORM := linux/arm64

help:
	@echo "RemoteLED Commands:"
	@echo ""
	@echo "  Development:"
	@echo "  make dev-backend   - Start FastAPI server (port 9999)"
	@echo "  make dev-frontend  - Start Vite dev server (port 5173)"
	@echo "  make test          - Run all tests"
	@echo "  make test-backend  - Run backend tests (pytest)"
	@echo "  make test-frontend - Run frontend tests (vitest)"
	@echo "  make install       - Install all dependencies"
	@echo ""
	@echo "  Database:"
	@echo "  make db-setup      - Create DB and load schema"
	@echo "  make db-reset      - Drop, recreate, and seed DB"
	@echo "  make db-seed       - Load seed data"
	@echo ""
	@echo "  Docker (Pi):"
	@echo "  make build         - Build containers for Raspberry Pi 4"
	@echo "  make app-up        - Start Pi services (detached)"
	@echo "  make app-down      - Stop Pi services"
	@echo "  make logs          - View all logs (follow mode)"
	@echo "  make clean         - Stop and remove all containers/volumes"
	@echo ""
	@echo "  Docker (Admin Stack):"
	@echo "  make admin-up      - Start backend + frontend + postgres"
	@echo "  make admin-down    - Stop admin stack"

build:
	@echo "Building containers for $(PLATFORM)..."
	docker compose build

app-up:
	@echo "Starting RemoteLED services..."
	docker compose up -d
	@echo "✓ Services running!"
	@echo "  - Web: http://localhost"
	@echo "  - BLE: active on host Bluetooth"

app-down:
	@echo "Stopping RemoteLED services..."
	docker compose down

logs:
	docker compose logs -f

logs-iot:
	docker compose logs -f iot-peripheral

logs-web:
	docker compose logs -f web-kiosk

clean:
	@echo "Cleaning up containers and volumes..."
	docker compose down -v
	@echo "✓ Cleanup complete"

# ============================================================
# Development
# ============================================================

dev-backend:
	cd backend && uv run --no-project uvicorn app.main:app --reload --host 0.0.0.0 --port 9999

dev-frontend:
	cd frontend/admin-react && npm run dev

test-backend:
	cd backend && uv run pytest tests/ -v

test-frontend:
	cd frontend/admin-react && npm run test

test: test-backend test-frontend

install:
	uv sync
	cd frontend/admin-react && npm install

# ============================================================
# Database
# ============================================================

db-setup:
	createdb remoteled 2>/dev/null || true
	psql -d remoteled -f database/schema.sql
	@echo "✓ Schema loaded. Run 'make db-seed' for test data."

db-reset:
	dropdb remoteled 2>/dev/null || true
	createdb remoteled
	psql -d remoteled -f database/schema.sql
	psql -d remoteled -f database/seed.sql
	@echo "✓ Database reset with seed data."

db-seed:
	psql -d remoteled -f database/seed.sql

# ============================================================
# Docker: Admin Stack
# ============================================================

admin-up:
	docker compose -f docker-compose.admin.yml up -d

admin-down:
	docker compose -f docker-compose.admin.yml down
