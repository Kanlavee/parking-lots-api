# Parking Lot API

A production-quality REST API for managing parking lots, assigning slots, and tracking vehicle tickets.

## Table of Contents

- [Tech Stack](#tech-stack)
- [ER Diagram](#er-diagram)
- [Design Decisions](#design-decisions)
- [Park Flow with Pessimistic Lock](#park-flow-with-pessimistic-lock)
- [Project Setup](#project-setup)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Response Envelope](#response-envelope)
- [Example Walkthrough](#example-walkthrough)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 11 (TypeScript strict mode) |
| Database | PostgreSQL 15 via TypeORM 0.3 |
| Containerisation | Docker (multi-stage build) + Docker Compose |
| Validation | class-validator + class-transformer |
| API Docs | Swagger UI (`/api`) |
| Unit Tests | Jest v30 — 47 tests, >80% coverage |
| E2E Tests | Jest + Supertest + pg-mem in-memory PostgreSQL (15 tests) |
| Concurrency Test | Jest + Supertest against real PostgreSQL (1 test) |

---

## ER Diagram

Three entities. A `ParkingLot` owns many `ParkingSlot`s. A `Ticket` records one car's stay in one slot.

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌─────────────────────────┐
│     parking_lot     │        │       parking_slot        │        │         ticket          │
├─────────────────────┤        ├──────────────────────────┤        ├─────────────────────────┤
│ id          UUID PK │1      *│ id            UUID PK    │1      *│ id            UUID PK   │
│ name        VARCHAR │────────│ parking_lot_id UUID FK   │────────│ parking_lot_id UUID FK  │
│ created_at  TIMESTAMP│       │ slot_number   INTEGER    │        │ parking_slot_id UUID FK │
└─────────────────────┘        │ slot_size     ENUM       │        │ plate_number  VARCHAR   │
                                │ is_available  BOOLEAN   │        │ car_size      ENUM      │
                                │ created_at    TIMESTAMP │        │ entry_time    TIMESTAMP │
                                └──────────────────────────┘        │ exit_time     TIMESTAMP │
                                                                     │ is_active     BOOLEAN   │
                                                                     │ created_at    TIMESTAMP │
                                                                     └─────────────────────────┘
```

**Key constraint:** `is_available` on `parking_slot` is the single source of truth for slot occupancy. It is flipped inside a pessimistic-write transaction to prevent double-booking.

---

## Design Decisions

### 1. Linear lot layout
A single-entrance lot maps naturally to a linear numbered-slot model (slot 1, 2, 3 … N) — no grid, no radius calculation needed.

### 2. Slots have a physical size
The spec mentions cars have a size but is silent on slots. Giving slots a size adds realistic constraints:

| Slot size | Accepts |
|---|---|
| `LARGE` | LARGE, MEDIUM, SMALL |
| `MEDIUM` | MEDIUM, SMALL |
| `SMALL` | SMALL only |

Smaller cars can use larger slots when no matching slot is free, maximising utilisation.

### 3. Slot assignment order: LARGE → MEDIUM → SMALL
Slots are numbered LARGE-first at creation time. The lowest numbers can accommodate the widest range of cars, so large slots are never "trapped" behind small ones.

### 4. Nearest-available-first assignment
`parkCar()` always picks the lowest-numbered compatible slot — deterministic and fair.

### 5. Uppercase normalisation
All `carSize` / `slotSize` values are `SMALL | MEDIUM | LARGE`. Plate numbers are normalised to uppercase on entry (`abc-1234` → `ABC-1234`).

### 6. Pessimistic write lock on slot selection
`parkCar()` wraps slot selection and reservation in a single transaction with `pessimistic_write` (`SELECT … FOR UPDATE`). Under concurrent requests only one transaction acquires the lock; the rest block until it commits, then see `is_available = false`. See the sequence diagram below.

---

## Park Flow with Pessimistic Lock

This diagram shows what happens when two cars try to park simultaneously in a lot with one slot left.

```
Client A                    API (TicketService)              PostgreSQL
   │                               │                              │
   │── POST /park ─────────────────▶                              │
   │                               │── BEGIN TRANSACTION ────────▶│
   │                               │── SELECT … FOR UPDATE ──────▶│ ← acquires row lock
   │                               │                              │  (slot is available)
   │                         ┌─────│                              │
Client B                     │     │                              │
   │── POST /park ────────────┼────▶                              │
   │                         │     │── BEGIN TRANSACTION ────────▶│
   │                         │     │── SELECT … FOR UPDATE ──────▶│ ← BLOCKS (row locked)
   │                         │     │                              │
   │                         └────▶│ slot.is_available = false    │
   │                               │── UPDATE parking_slot ───────▶│
   │                               │── INSERT ticket ─────────────▶│
   │                               │── COMMIT ────────────────────▶│ ← lock released
   │◀── 201 Created ───────────────│                              │
   │                               │                              │ ← Client B unblocks
   │                               │◀─ slot.is_available = false ─│
   │                               │── ROLLBACK (no slot found) ──▶│
   │                         ┌─────│                              │
   │◀── 422 Unprocessable ───│     │                              │
```

**Result:** Only Client A parks. Client B receives `422 Unprocessable Entity — No available slot`.

This behaviour is verified by the concurrency stress test (`npm run test:concurrency`) which fires 10 simultaneous requests at a 1-slot lot and asserts exactly 1 success and 9 failures.

---

## Project Setup

### Prerequisites
- Node.js 20+
- Docker + Docker Compose

### Start with Docker (recommended)

```bash
# Build and start PostgreSQL + API together
docker compose up --build

# API   → http://localhost:3000
# Swagger UI → http://localhost:3000/api
```

Re-running `docker compose up --build` is safe — PostgreSQL data is persisted in a named volume (`postgres_data`) and TypeORM `synchronize` is idempotent.

### Start without Docker (requires a local PostgreSQL instance)

```bash
cp .env.example .env   # fill in DB credentials
npm install
npm run start:dev
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Controls logging and TypeORM synchronize |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_DATABASE` | `parking_lot_db` | Database name |

---

## Running Tests

```bash
# Unit tests (47 tests, no database required)
npm test

# E2E tests (15 tests, no database required — uses pg-mem in-memory PostgreSQL)
npm run test:e2e

# Concurrency stress test (requires Docker DB to be running)
docker compose up -d postgres   # start DB only
npm run test:concurrency        # fires 10 simultaneous park requests → 1 wins, 9 fail 422

# Coverage report
npm run test:cov
```

> **Note:** The concurrency test is safe to re-run without restarting Docker. Each run creates a new parking lot via the API, so there is no leftover state from previous runs.

---

## API Reference

### Parking Lots

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/parking-lots` | Create a parking lot with sized slot groups |
| `GET` | `/parking-lots/:id/status?limit=&offset=` | Slot map with pagination and occupant per slot |
| `GET` | `/parking-lots/:id/cars?size=` | Plate numbers of parked cars filtered by car size |
| `GET` | `/parking-lots/:id/slots?size=` | Slot numbers occupied by a given car size |

### Tickets

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/parking-lots/:id/park` | Park a car — returns a ticket |
| `POST` | `/parking-lots/:id/leave/:ticketId` | Release a slot — returns duration parked |

Full interactive documentation (request/response schemas, try-it-out) is at `/api` when the app is running.

---

## Response Envelope

Every response is wrapped by a global interceptor and exception filter.

**Success (`2xx`):**
```json
{
  "data": { "...": "..." },
  "timestamp": "2026-04-04T08:00:00.000Z",
  "path": "/parking-lots"
}
```

**Error (`4xx` / `5xx`):**
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
# 1. Create a parking lot — 2 LARGE, 3 MEDIUM, 5 SMALL slots (numbered 1-10, LARGE first)
curl -X POST http://localhost:3000/parking-lots \
  -H "Content-Type: application/json" \
  -d '{"name":"Central Parking","slots":[{"size":"LARGE","count":2},{"size":"MEDIUM","count":3},{"size":"SMALL","count":5}]}'
# → { "data": { "id": "<lotId>", "totalSlots": 10, ... } }

# 2. Park a MEDIUM car — picks slot 1 (LARGE, nearest, accepts MEDIUM)
curl -X POST http://localhost:3000/parking-lots/<lotId>/park \
  -H "Content-Type: application/json" \
  -d '{"plateNumber":"ABC-1234","carSize":"MEDIUM"}'
# → { "data": { "ticketId": "<ticketId>", "slotNumber": 1, ... } }

# 3. Check lot status (paginated)
curl "http://localhost:3000/parking-lots/<lotId>/status?limit=10&offset=0"

# 4. Query which MEDIUM cars are parked
curl "http://localhost:3000/parking-lots/<lotId>/cars?size=MEDIUM"

# 5. Leave — returns how long the car was parked
curl -X POST http://localhost:3000/parking-lots/<lotId>/leave/<ticketId>
# → { "data": { "duration": "45 minutes", ... } }
```

