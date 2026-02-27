# RemoteLED System Documentation

## What RemoteLED Is

RemoteLED is a cashless payment activation system for unattended machines — laundry washers, dryers, air compressors, vending dispensers, or any device controlled by a relay. It replaces coin mechanisms with QR-code-initiated mobile payments.

A Raspberry Pi is mounted at each machine. It runs a BLE peripheral and displays a QR code on a small kiosk screen. A customer scans the QR code with their phone, picks a service, pays via Stripe, and the Pi activates a GPIO relay for the purchased duration. The system uses ECDSA cryptographic signatures to ensure the Pi only activates when the backend has confirmed payment — the phone cannot forge an activation command.

## System Components

### 1. Raspberry Pi (Edge Device)

Each Pi serves as both the user-facing kiosk and the physical controller for one machine.

**BLE Peripheral** (`pi/python/code.py`): Runs a Bluetooth Low Energy GATT server using the `bluezero` library. On boot, it generates a deep-link URL containing its BLE MAC address, service UUID, characteristic UUID, and a session key (`bleKey`). It publishes this URL as a QR code to the kiosk screen.

The BLE characteristic accepts JSON commands written by the Android app:
- `ON` — turn on an LED (color specified), update kiosk to "Service Active"
- `BLINK` — blink an LED (payment processing state)
- `OFF` — turn off all LEDs, return to red idle, restore QR code for next customer
- `CONNECT` — acknowledgment that the app has connected
- `RESET` — full state reset (stop blink, all off, red on, restore QR)

Every command requires a matching `bleKey` field. Invalid keys are rejected silently.

**LED Service** (`pi/python/led_service.py`): Abstracts GPIO pin control. Three LEDs on BCM pins 17 (green), 19 (yellow), 27 (red). Supports solid on, off, and non-blocking blink via threading. Falls back to a mock implementation when GPIO is unavailable (e.g., macOS development).

**Kiosk** (`pi/kiosk/` or `pi/web/`): A fullscreen Chromium browser displaying either a React app or static HTML. Reads `state.json` written atomically by the BLE peripheral. The kiosk displays different views based on the `status` field: `QR` (show QR code), `CONNECTED` (device connected), `SCANNED` (processing), `RUNNING` (service active with countdown timer).

**Startup**: The Pi runs `remoteled-python.service` (or the Node.js alternative, mutually exclusive) via systemd. nginx serves the kiosk at port 80. Chromium autostarts in kiosk mode via Wayfire/LXDE.

### 2. Android App (Client)

A Kotlin Android app (`android/RemoteLedBLE/`) that acts as the customer's payment terminal and BLE relay.

**QR Scanning**: Uses CameraX + ML Kit barcode scanning to read the QR code displayed on the Pi kiosk. The QR encodes a URL like:
```
{API_BASE_URL}/detail?machineId={device_id}&mac={MAC}&service={svc16}&char={char16}&key={bleKey}
```

**Deep Link Handling**: The app can also be launched via deep links (`remoteled://connect/...`), allowing the URL to work even if scanned with the phone's native camera.

**BLE GATT Client**: After extracting connection parameters from the QR/deep link, the app connects to the Pi as a BLE GATT client. It writes JSON commands to the characteristic to control LEDs and communicate state.

**Payment Flow**: The app calls the backend API to create orders, process Stripe payments, and fetch ECDSA-signed authorizations. It then relays the signed authorization to the Pi over BLE, which the Pi can verify cryptographically before activating the relay.

**Telemetry**: The app reports lifecycle events (STARTED, DONE, ERROR) back to the backend via REST, which updates order status and logs telemetry.

### 3. Backend API (Server)

A Python FastAPI server (`backend/app/`) running on port 9999. It is the central coordinator between the mobile app, Stripe, and the database.

**Authentication** (`app/core/auth.py`): JWT-based (HS256, 7-day expiry) for admin endpoints. Uses bcrypt for password hashing. Public endpoints (device lookup, order creation, payments) do not require authentication — they are called by the customer's phone.

**Order Management** (`app/api/orders.py`): Implements the order state machine:
```
CREATED ──→ PAID ──→ RUNNING ──→ DONE
   │          │         │
   └──→ FAILED ←──┘ ←──┘
```
Transitions are strictly validated. An order is created when the customer selects a service. It moves to PAID after Stripe confirms payment. RUNNING when the Pi activates. DONE when the service completes. FAILED if anything goes wrong at any stage.

**Payment Processing** (`app/api/payments.py`): Wraps the Stripe SDK. The key endpoint is `POST /payments/stripe/payment-and-trigger`, which:
1. Creates a Stripe PaymentIntent
2. Auto-confirms with `pm_card_visa` in test mode
3. Updates the order to PAID
4. Returns the payment result (LED control is handled separately by the app)

A mock payment mode (`ENABLE_MOCK_PAYMENT=true`) allows development without Stripe keys.

**Authorization Signing** (`app/api/authorizations.py`, `app/services/crypto.py`): After payment, the app requests an ECDSA-signed authorization. The backend:
1. Verifies the order is in PAID status
2. Creates a payload: `{deviceId, orderId, type, seconds, nonce, exp}`
3. Signs it with ECDSA (secp256k1 curve) using domain-separated SHA-256 hashing
4. Stores the authorization with signature and expiry in the database
5. Returns the signed payload to the app

The app relays this to the Pi over BLE. The Pi can verify the signature against the device's public key without trusting the phone. The nonce prevents replay attacks. The `exp` field prevents stale authorizations.

**LED Control** (`app/api/led.py`, `app/core/led_handler.py`): The backend can also control Pi LEDs directly over BLE (from macOS during development) using the Bleak library. It scans for the Pi by service UUID, caches the address, and writes JSON commands to the GATT characteristic. In production, the Android app controls LEDs directly — the backend LED endpoint is primarily for testing and admin use.

**Telemetry** (`app/api/telemetry.py`): Receives lifecycle events from the app (STARTED, DONE, ERROR), logs them to the `logs` table, and updates order status accordingly.

**Admin Console API** (`app/api/admin.py`, `app/api/reference.py`): Protected endpoints for the admin dashboard. Provides CRUD for devices, services, service assignments, and reference data (device models, locations, service types). Includes analytics: dashboard stats, order charts, device status breakdowns, and audit logs.

### 4. Admin Console (Frontend)

A React 18 + TypeScript + Vite single-page application (`frontend/admin-react/`) for operators to manage the system.

**Dashboard**: Overview stats (total devices, active orders, revenue, success rate), order charts (last 7 days), and device status breakdown.

**Device Management**: CRUD for Pi devices. Each device has a label, public key, model, location, GPIO pin, and status. Devices can be assigned services.

**Service/Product Management**: CRUD for services. Three types with different pricing:
- **TRIGGER** — one-shot activation, fixed price, no duration (e.g., vending dispenser)
- **FIXED** — set duration for a set price (e.g., 30-minute washer cycle for $2.00)
- **VARIABLE** — pay-per-time (e.g., X minutes per $0.25 for a dryer)

**Live Orders Panel**: Real-time view of order lifecycle with status tracking.

**Logs**: Device telemetry and admin audit trail.

### 5. Database (PostgreSQL)

PostgreSQL 15+ with raw SQL access (no ORM). The schema (`database/schema.sql`) defines:

**Core Tables**:
- `devices` — registered Pi machines with public keys and GPIO configuration
- `services` — available products with type-specific pricing rules
- `device_services` — many-to-many assignment of services to devices
- `orders` — customer orders tracking the full payment→activation→completion lifecycle
- `authorizations` — ECDSA-signed payloads (one per order, unique constraint)

**Reference Tables**: `device_models`, `locations`, `service_types` — normalized lookup data.

**Audit Tables**: `logs` (device telemetry), `admin_logs` (admin action trail).

**Database Constraints**: Service type validation is enforced at the DB level — TRIGGER services cannot have `fixed_minutes` or `minutes_per_25c`, FIXED must have `fixed_minutes`, VARIABLE must have `minutes_per_25c`. Orders reference devices and services with RESTRICT delete (cannot delete a device that has orders).

## End-to-End Flow

Here is the complete flow from a customer scanning a QR code to the machine activating:

```
1. Pi boots up
   ├── BLE peripheral starts, generates QR URL with MAC + UUIDs + bleKey
   ├── Kiosk displays QR code
   └── Red LED on (idle state)

2. Customer scans QR code with Android app
   ├── App extracts: device_id, MAC address, service UUID, char UUID, bleKey
   ├── App connects to Pi via BLE GATT
   ├── App sends CONNECT command to Pi
   └── Kiosk shows "Device Connected"

3. App fetches device services from backend
   ├── GET /devices/{device_id}/services
   └── Displays available services with prices

4. Customer selects a service
   ├── App creates order: POST /orders {device_id, service_id, amount_cents}
   ├── Backend validates device, service, assignment, calculates authorized_minutes
   └── Order created with status CREATED

5. Customer pays
   ├── App calls: POST /payments/stripe/payment-and-trigger
   ├── Backend creates Stripe PaymentIntent, confirms payment
   ├── Order status → PAID
   ├── App sends BLINK command to Pi (yellow LED = processing)
   └── Kiosk shows "Processing..."

6. App requests authorization
   ├── POST /authorizations {order_id}
   ├── Backend verifies order is PAID, creates payload, signs with ECDSA
   └── Returns signed authorization {payload, signature, expires_at}

7. App activates the device
   ├── App sends ON command to Pi with color based on service type
   │   (FIXED → green, VARIABLE → yellow, TRIGGER → red)
   ├── App reports STARTED telemetry: POST /devices/{id}/telemetry
   ├── Order status → RUNNING
   ├── Pi activates GPIO relay
   └── Kiosk shows "Service Active" with countdown timer

8. Service completes
   ├── App timer expires (or TRIGGER fires instantly)
   ├── App sends OFF command to Pi
   ├── App reports DONE telemetry: POST /devices/{id}/telemetry
   ├── Order status → DONE
   ├── Pi turns off relay, sets red LED (idle), restores QR code
   └── Kiosk returns to QR display for next customer
```

## Security Model

**Payment Verification**: The ECDSA signing scheme ensures that a Pi only activates when the backend (which has verified Stripe payment) issues a cryptographically signed authorization. The phone relays the signed payload but cannot forge one. The Pi holds a public key and can verify the signature independently.

**BLE Session Keys**: Each Pi session uses a `bleKey` (currently a static 4-hex-digit key embedded in the QR code). The BLE peripheral rejects commands with invalid keys. This prevents casual interference but is not strong security — production deployments should implement per-session key rotation or challenge-response.

**Admin Authentication**: JWT tokens with bcrypt-hashed passwords. The admin console uses localStorage for token persistence with automatic 401 handling and redirect to login.

**API Surface**: Public endpoints (device lookup, orders, payments) are intentionally unauthenticated — they are called by customer phones. Admin endpoints (CRUD, stats, logs) require JWT. This split is by design: the payment flow is secured by Stripe + ECDSA, not by API authentication.

## LED Color Scheme

LEDs provide visual status feedback to both the operator and the customer:

| State | LED | Meaning |
|-------|-----|---------|
| Idle / Ready | Red solid | Pi is ready, waiting for customer |
| Processing payment | Yellow blink | Payment in progress |
| Service active (FIXED) | Green solid | Fixed-duration service running |
| Service active (VARIABLE) | Yellow solid | Variable-duration service running |
| Service active (TRIGGER) | Red solid | Instant trigger activated |
| Error | Red blink | Something went wrong |
| Off / shutdown | All off | Pi is not running |

## Pricing Models in Detail

**TRIGGER** (`service_type = 'TRIGGER'`):
- One-shot activation. Customer pays a fixed price, the relay fires for ~2 seconds.
- Use case: vending dispenser, parking meter pulse, gate opener.
- `price_cents` is the cost. `fixed_minutes` and `minutes_per_25c` must be NULL.
- `authorized_minutes` on the order is always 0.

**FIXED** (`service_type = 'FIXED'`):
- Fixed duration for a fixed price. Customer pays once, gets a set number of minutes.
- Use case: washer (40 min cycle for $2.00), car wash bay (15 min for $5.00).
- `price_cents` is the cost. `fixed_minutes` is the duration. `minutes_per_25c` must be NULL.
- `authorized_minutes` = `fixed_minutes` from the service definition.

**VARIABLE** (`service_type = 'VARIABLE'`):
- Pay-per-time. The more the customer pays, the more time they get.
- Use case: dryer (5 min per $0.25), EV charger (10 min per $1.00).
- `price_cents` is the minimum charge. `minutes_per_25c` is the rate.
- `authorized_minutes` = `(amount_cents / 25) * minutes_per_25c`.

## Deployment Topology

```
┌─────────────────────────────────┐
│          Cloud / Server         │
│  ┌───────────┐  ┌───────────┐  │
│  │  FastAPI   │  │ PostgreSQL│  │
│  │  Backend   │──│  Database │  │
│  │  :9999     │  │  :5432    │  │
│  └─────┬─────┘  └───────────┘  │
│        │ REST API               │
└────────┼────────────────────────┘
         │
         │ HTTPS
         │
┌────────┼────────────────────────┐
│  ┌─────┴─────┐   Android App   │
│  │  Stripe   │   (Customer's   │
│  │  Payment  │    Phone)       │
│  └───────────┘                  │
│        │ BLE GATT               │
└────────┼────────────────────────┘
         │
┌────────┼────────────────────────┐
│  ┌─────┴─────┐  Raspberry Pi   │
│  │    BLE    │  (Edge Device)   │
│  │ Peripheral│                  │
│  └─────┬─────┘                  │
│        │ GPIO                   │
│  ┌─────┴─────┐  ┌───────────┐  │
│  │   Relay   │  │   Kiosk   │  │
│  │  + LEDs   │  │  Screen   │  │
│  └───────────┘  └───────────┘  │
│        │                        │
│  ┌─────┴─────┐                  │
│  │  Machine  │                  │
│  │ (Washer,  │                  │
│  │  Dryer,   │                  │
│  │  etc.)    │                  │
│  └───────────┘                  │
└─────────────────────────────────┘
```

The backend and database can run anywhere with a public IP (cloud VM, local server). Each Pi connects to the backend over the network for QR URL generation and telemetry. The Android app connects to both the backend (REST over HTTPS) and the Pi (BLE over Bluetooth). The Pi and the machine it controls are co-located — the GPIO relay physically switches the machine's power or signal line.
