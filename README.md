# Parking Lot API

A production-quality REST API for managing parking lots, assigning slots, and tracking vehicle tickets — built as a backend interview test.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 11 (TypeScript strict mode) |
| Database | PostgreSQL 15 via TypeORM 0.3 |
| Containerisation | Docker (multi-stage build) + Docker Compose |
| Validation | class-validator + class-transformer |
| API Docs | Swagger UI (`/api`) |
| Unit Tests | Jest v30 (40 tests) |
| E2E Tests | Jest + Supertest + pg-mem in-memory PostgreSQL (15 tests) |

## Design Decisions

### 1. Linear lot layout
The spec says there is a single entrance. A linear numbered-slot model (slot 1, 2, 3 ... N) is the simplest layout that matches reality — no grid, no radius.

### 2. Slots have a physical size
The spec mentions cars have a size but is silent on slots. I chose to give slots a size too because it is more realistic and adds meaningful business logic:
- `LARGE` slot → accepts LARGE cars only  
- `MEDIUM` slot → accepts LARGE or MEDIUM cars  
- `SMALL` slot → accepts any car size

### 3. Slot assignment order: LARGE → MEDIUM → SMALL
When a lot is created, slots are numbered in LARGE-first order. This guarantees the nearest slots (lowest numbers) can accommodate the widest range of cars, minimising wasted large slots for small cars in practice.

### 4. Nearest-available-first assignment
When parking a car, the system picks the lowest-numbered compatible slot. This is deterministic and fair.

### 5. Uppercase normalisation
All `carSize` / `slotSize` values are stored as `SMALL | MEDIUM | LARGE`. Plate numbers are normalised to uppercase on entry (e.g. `abc-1234` → `ABC-1234`).

### 6. Pessimistic write lock on slot selection
`parkCar()` wraps slot selection and reservation in a transaction with a `pessimistic_write` lock, preventing double-booking under concurrent requests.

---

## Project Setup

### Prerequisites
- Node.js 20+
- Docker + Docker Compose (for the database)

### Run locally with Docker

```bash
# Start PostgreSQL and the API together
docker compose up --build

# API is available at http://localhost:3000
# Swagger UI is available at http://localhost:3000/api
```

### Run locally without Docker (requires a running PostgreSQL instance)

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# 2. Install dependencies
npm install

# 3. Start in watch mode
npm run start:dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Controls logging and synchronize |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_DATABASE` | `parking_lot_db` | Database name |

---

## Running Tests

```bash
# All unit tests (40 tests)
npm test

# All E2E tests — no database required, uses pg-mem in-memory PostgreSQL (15 tests)
npm run test:e2e

# Coverage report
npm run test:cov
```

---

## API Reference

### Parking Lots

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/parking-lots` | Create a new parking lot with sized slot groups |
| `GET` | `/parking-lots/:id/status` | Full slot map with current occupant per slot |
| `GET` | `/parking-lots/:id/cars?size=` | Plate numbers of parked cars filtered by car size |
| `GET` | `/parking-lots/:id/slots?size=` | Slot numbers occupied by a given car size |

### Tickets

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/parking-lots/:id/park` | Park a car — returns a ticket |
| `POST` | `/parking-lots/:id/leave/:ticketId` | Release a slot — returns duration |

Interactive documentation with request/response schemas is available at `/api` (Swagger UI) when the app is running.

---

## Response Envelope

All responses are wrapped by a global interceptor and filter:

**Success:**
```json
{
  "data": { ... },
  "timestamp": "2026-04-04T08:00:00.000Z",
  "path": "/parking-lots"
}
```

**Error:**
```json
{
  "statusCode": 404,
  "message": "Parking lot with id \"abc\" not found.",
  "error": "Not Found",
  "path": "/parking-lots/abc/status",
  "timestamp": "2026-04-04T08:00:00.000Z"
}
```

---

## Example Walkthrough

```bash
# 1. Create a parking lot with 2 LARGE, 3 MEDIUM, 5 SMALL slots
curl -X POST http://localhost:3000/parking-lots \
  -H "Content-Type: application/json" \
  -d '{"name":"Central Parking","slots":[{"size":"LARGE","count":2},{"size":"MEDIUM","count":3},{"size":"SMALL","count":5}]}'

# 2. Park a medium car (uses nearest compatible slot — slot 1 or 2, which are LARGE and accept MEDIUM)
curl -X POST http://localhost:3000/parking-lots/<lotId>/park \
  -H "Content-Type: application/json" \
  -d '{"plateNumber":"ABC-1234","carSize":"MEDIUM"}'

# 3. Check lot status
curl http://localhost:3000/parking-lots/<lotId>/status

# 4. Query which MEDIUM cars are parked
curl "http://localhost:3000/parking-lots/<lotId>/cars?size=MEDIUM"

# 5. Release the slot
curl -X POST http://localhost:3000/parking-lots/<lotId>/leave/<ticketId>
```

