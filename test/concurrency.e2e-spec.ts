/**
 * Concurrency stress test — pessimistic lock prevents double-booking
 *
 * ⚠️  REQUIRES A RUNNING POSTGRESQL INSTANCE
 *
 *   docker compose up -d db
 *   npm run test:concurrency
 *
 * Why a separate file?
 * --------------------
 * The main E2E suite (app.e2e-spec.ts) uses pg-mem (in-memory PostgreSQL)
 * which does NOT enforce SELECT FOR UPDATE / pessimistic_write row locks.
 * Under pg-mem, concurrent transactions run without blocking each other, so
 * multiple requests can all read is_available=true for the same slot.
 *
 * Real PostgreSQL serialises them: the first transaction acquires the row
 * lock, the rest block until it commits, then each one sees is_available=false
 * and returns 422. That is the behaviour this test verifies.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Concurrency — pessimistic lock prevents double-booking (real PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('only 1 car wins when 10 requests race for the last available slot', async () => {
    // Create a lot with exactly 1 SMALL slot
    const createRes = await request(app.getHttpServer())
      .post('/parking-lots')
      .send({ name: 'Race Lot', slots: [{ size: 'SMALL', count: 1 }] })
      .expect(201);

    const raceLotId: string = createRes.body.data.id;

    // Fire 10 park requests simultaneously — all compete for slot #1
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/parking-lots/${raceLotId}/park`)
          .send({ plateNumber: `RACE-${String(i).padStart(3, '0')}`, carSize: 'SMALL' }),
      ),
    );

    const statuses = results.map((r) => r.status);
    const successes = statuses.filter((s) => s === 201);
    const failures = statuses.filter((s) => s === 422);

    // Exactly one car should have acquired the row lock and parked
    expect(successes).toHaveLength(1);
    // The remaining 9 must fail with 422 (no available slot)
    expect(failures).toHaveLength(9);

    // ── Verify final system state ─────────────────────────────────────────
    // The status endpoint must show exactly 1 occupied slot regardless
    const statusRes = await request(app.getHttpServer())
      .get(`/parking-lots/${raceLotId}/status`)
      .expect(200);

    expect(statusRes.body.data.occupiedSlots).toBe(1);
    expect(statusRes.body.data.availableSlots).toBe(0);
  });
});
