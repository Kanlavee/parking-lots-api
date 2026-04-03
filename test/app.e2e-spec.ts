import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { newDb, DataType } from 'pg-mem';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParkingLotController } from '../src/parking-lot/parking-lot.controller';
import { ParkingLotService } from '../src/parking-lot/parking-lot.service';
import { TicketController } from '../src/ticket/ticket.controller';
import { TicketService } from '../src/ticket/ticket.service';
import { ParkingLot } from '../src/parking-lot/entities/parking-lot.entity';
import { ParkingSlot } from '../src/parking-lot/entities/parking-slot.entity';
import { Ticket } from '../src/ticket/entities/ticket.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

async function createTestDataSource(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  // TypeORM calls SELECT version() on driver init
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 15.0 on x86_64-pc-linux-gnu, compiled by gcc',
  });

  // TypeORM may call current_database()
  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test',
  });

  // TypeORM sets uuid_generate_v4() as column DEFAULT for @PrimaryGeneratedColumn('uuid')
  db.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
    impure: true,
  });

  const ds = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [ParkingLot, ParkingSlot, Ticket],
    synchronize: true,
    logging: false,
  } as any);
  await ds.initialize();
  return ds;
}

describe('Parking Lot API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const dataSource = await createTestDataSource();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ParkingLotController, TicketController],
      providers: [
        ParkingLotService,
        TicketService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(ParkingLot), useValue: dataSource.getRepository(ParkingLot) },
        { provide: getRepositoryToken(ParkingSlot), useValue: dataSource.getRepository(ParkingSlot) },
        { provide: getRepositoryToken(Ticket), useValue: dataSource.getRepository(Ticket) },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /parking-lots ────────────────────────────────────────────────────

  describe('POST /parking-lots', () => {
    it('201 — creates a parking lot and returns slot summary', async () => {
      const res = await request(app.getHttpServer())
        .post('/parking-lots')
        .send({
          name: 'Central Parking',
          slots: [
            { size: 'LARGE', count: 2 },
            { size: 'MEDIUM', count: 3 },
            { size: 'SMALL', count: 5 },
          ],
        })
        .expect(201);

      expect(res.body.data.name).toBe('Central Parking');
      expect(res.body.data.totalSlots).toBe(10);
      expect(res.body.data.availableSlots).toBe(10);
      expect(res.body.data.slotSummary[0].size).toBe('LARGE');
      expect(res.body.data.slotSummary[0].slotNumbers).toBe('1-2');
      expect(res.body.data.id).toBeDefined();
    });

    it('400 — rejects when slot sizes are duplicated', async () => {
      await request(app.getHttpServer())
        .post('/parking-lots')
        .send({
          name: 'Bad Lot',
          slots: [
            { size: 'LARGE', count: 5 },
            { size: 'LARGE', count: 3 },
          ],
        })
        .expect(400);
    });

    it('400 — rejects when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/parking-lots')
        .send({ slots: [{ size: 'LARGE', count: 5 }] })
        .expect(400);
    });
  });

  // ── Full parking flow ─────────────────────────────────────────────────────

  describe('Full parking flow', () => {
    let lotId: string;
    let ticketId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/parking-lots')
        .send({
          name: 'Flow Test Lot',
          slots: [
            { size: 'LARGE', count: 1 },
            { size: 'MEDIUM', count: 2 },
            { size: 'SMALL', count: 3 },
          ],
        })
        .expect(201);

      lotId = res.body.data.id;
    });

    it('201 — parks a car and returns a ticket', async () => {
      const res = await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/park`)
        .send({ plateNumber: 'abc-1234', carSize: 'MEDIUM' })
        .expect(201);

      expect(res.body.data.ticketId).toBeDefined();
      expect(res.body.data.plateNumber).toBe('ABC-1234'); // normalized uppercase
      expect(res.body.data.carSize).toBe('MEDIUM');
      expect(res.body.data.slotNumber).toBeDefined();
      expect(res.body.data.entryTime).toBeDefined();

      ticketId = res.body.data.ticketId;
    });

    it('200 GET status — shows 1 occupied slot and correct available count', async () => {
      const res = await request(app.getHttpServer())
        .get(`/parking-lots/${lotId}/status`)
        .expect(200);

      expect(res.body.data.availableSlots).toBe(5);
      expect(res.body.data.occupiedSlots).toBe(1);
      const occupied = res.body.data.slots.find((s: any) => !s.isAvailable);
      expect(occupied).toBeDefined();
      expect(occupied.currentCar.plateNumber).toBe('ABC-1234');
    });

    it('200 GET cars?size=MEDIUM — returns the parked car plate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/parking-lots/${lotId}/cars?size=MEDIUM`)
        .expect(200);

      expect(res.body.data.carSize).toBe('MEDIUM');
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.plateNumbers).toContain('ABC-1234');
    });

    it('200 GET slots?size=MEDIUM — returns the occupied slot number', async () => {
      const res = await request(app.getHttpServer())
        .get(`/parking-lots/${lotId}/slots?size=MEDIUM`)
        .expect(200);

      expect(res.body.data.carSize).toBe('MEDIUM');
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.slotNumbers).toHaveLength(1);
    });

    it('200 — leaves the parking slot and returns duration', async () => {
      const res = await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/leave/${ticketId}`)
        .expect(200);

      expect(res.body.data.ticketId).toBe(ticketId);
      expect(res.body.data.plateNumber).toBe('ABC-1234');
      expect(res.body.data.duration).toBeDefined();
      expect(res.body.data.exitTime).toBeDefined();
    });

    it('200 GET status — slot is freed after leaving', async () => {
      const res = await request(app.getHttpServer())
        .get(`/parking-lots/${lotId}/status`)
        .expect(200);

      expect(res.body.data.availableSlots).toBe(6);
      expect(res.body.data.occupiedSlots).toBe(0);
      const allFree = res.body.data.slots.every((s: any) => s.isAvailable);
      expect(allFree).toBe(true);
    });

    it('409 — cannot leave with the same ticket twice', async () => {
      await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/leave/${ticketId}`)
        .expect(409); // ConflictException: ticket already closed
    });
  });

  // ── Error cases ───────────────────────────────────────────────────────────

  describe('Error cases', () => {
    let lotId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/parking-lots')
        .send({
          name: 'Error Test Lot',
          slots: [{ size: 'SMALL', count: 1 }],
        })
        .expect(201);
      lotId = res.body.data.id;
    });

    it('404 — GET status for non-existent lot', async () => {
      await request(app.getHttpServer())
        .get('/parking-lots/00000000-0000-0000-0000-000000000000/status')
        .expect(404);
    });

    it('404 — park car in non-existent lot', async () => {
      await request(app.getHttpServer())
        .post('/parking-lots/00000000-0000-0000-0000-000000000000/park')
        .send({ plateNumber: 'ZZZ-999', carSize: 'SMALL' })
        .expect(404);
    });

    it('422 — lot full: rejects parking when no compatible slot available', async () => {
      // Fill the only SMALL slot
      await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/park`)
        .send({ plateNumber: 'CAR-001', carSize: 'SMALL' })
        .expect(201);

      // Try to park another car — lot is full
      await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/park`)
        .send({ plateNumber: 'CAR-002', carSize: 'SMALL' })
        .expect(422); // UnprocessableEntityException: no available slot
    });

    it('400 — rejects invalid carSize enum value', async () => {
      await request(app.getHttpServer())
        .post(`/parking-lots/${lotId}/park`)
        .send({ plateNumber: 'CAR-003', carSize: 'JUMBO' })
        .expect(400);
    });

    it('400 — rejects invalid size query param in GET cars', async () => {
      await request(app.getHttpServer())
        .get(`/parking-lots/${lotId}/cars?size=JUMBO`)
        .expect(400);
    });
  });
});

