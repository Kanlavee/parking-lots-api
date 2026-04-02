# Parking Lot System

## Assumptions
- Parking lot has a single entry point
- Slot 1 is nearest to entry, Slot N is farthest  
- Small car can park in Small/Medium/Large slot
- Medium car can park in Medium/Large slot
- Large car can park in Large slot only
- One car = one plate number, no duplicate parking

## Tech Stack
- NestJS, TypeScript, PostgreSQL, TypeORM, Docker

## Database Schema

### Entity 1: ParkingLot
```
id            UUID, PK, default gen_random_uuid()
name          VARCHAR(255), NOT NULL
total_slots   INTEGER, NOT NULL
created_at    TIMESTAMP, default NOW()
updated_at    TIMESTAMP, default NOW()
```

### Entity 2: ParkingSlot
```
id             UUID, PK
parking_lot_id UUID, FK → parking_lot.id, NOT NULL
slot_number    INTEGER, NOT NULL  ← lower = nearer to entry
slot_size      ENUM('SMALL','MEDIUM','LARGE'), NOT NULL
is_available   BOOLEAN, default TRUE
created_at     TIMESTAMP
updated_at     TIMESTAMP

UNIQUE constraint: (parking_lot_id, slot_number)
INDEX on: (parking_lot_id, is_available, slot_size, slot_number)
```

### Entity 3: Ticket
```
id               UUID, PK
parking_lot_id   UUID, FK → parking_lot.id
parking_slot_id  UUID, FK → parking_slot.id
plate_number     VARCHAR(20), NOT NULL
car_size         ENUM('SMALL','MEDIUM','LARGE'), NOT NULL
entry_time       TIMESTAMP, default NOW()
exit_time        TIMESTAMP, NULLABLE
is_active        BOOLEAN, default TRUE  ← false = car has left
created_at       TIMESTAMP
updated_at       TIMESTAMP

INDEX on: (parking_lot_id, is_active)
INDEX on: (plate_number, is_active)
```

---



