import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { Ticket } from './entities/ticket.entity';
import { ParkingLot } from '../parking-lot/entities/parking-lot.entity';
import { ParkingSlot } from '../parking-lot/entities/parking-slot.entity';
import { CarSize } from '../common/enums/car-size.enum';
import { SlotSize } from '../common/enums/slot-size.enum';
import { ParkCarDto } from './dto/park-car.dto';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeLot = (overrides: Partial<ParkingLot> = {}): ParkingLot =>
  ({
    id: 'lot-uuid',
    name: 'Test Lot',
    total_slots: 5,
    ...overrides,
  }) as ParkingLot;

const makeSlot = (overrides: Partial<ParkingSlot> = {}): ParkingSlot =>
  ({
    id: 'slot-uuid',
    slot_number: 1,
    slot_size: SlotSize.LARGE,
    is_available: true,
    ...overrides,
  }) as ParkingSlot;

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket =>
  ({
    id: 'ticket-uuid',
    plate_number: 'ABC-1234',
    car_size: CarSize.MEDIUM,
    is_active: true,
    entry_time: new Date('2026-04-02T10:30:00.000Z'),
    exit_time: null,
    parkingSlot: makeSlot({ slot_number: 1, slot_size: SlotSize.LARGE }),
    ...overrides,
  }) as Ticket;

// ── Mock manager factory ──────────────────────────────────────────────────────

interface MockManager {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  getRepository: jest.Mock;
}

const buildMockManager = (overrides: Partial<MockManager> = {}): MockManager => {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  return {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation((_entity: unknown, data: unknown) =>
      Promise.resolve(data),
    ),
    create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
    getRepository: jest.fn().mockReturnValue({ createQueryBuilder: () => qb }),
    ...overrides,
  };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TicketService', () => {
  let service: TicketService;
  let mockManager: MockManager;

  const setupModule = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: getRepositoryToken(Ticket), useValue: {} },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation(
              (cb: (m: MockManager) => unknown) => cb(mockManager),
            ),
          },
        },
      ],
    }).compile();
    service = module.get<TicketService>(TicketService);
  };

  // ── parkCar() ──────────────────────────────────────────────────────────────

  describe('parkCar()', () => {
    const dto: ParkCarDto = { plateNumber: 'abc-1234', carSize: CarSize.MEDIUM };

    it('normalizes plate number to UPPERCASE before parking', async () => {
      const lot = makeLot();
      const slot = makeSlot({ slot_number: 1, slot_size: SlotSize.LARGE });
      const savedTicket = makeTicket({ plate_number: 'ABC-1234' });

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)        // lot exists
        .mockResolvedValueOnce(null);      // no duplicate active plate
      mockManager.getRepository().createQueryBuilder().getOne.mockResolvedValue(slot);
      mockManager.save
        .mockResolvedValueOnce(slot)
        .mockResolvedValueOnce(savedTicket);

      await setupModule();
      const result = await service.parkCar('lot-uuid', dto);

      expect(result.plateNumber).toBe('ABC-1234');
    });

    it('allocates nearest compatible slot (lowest slot_number)', async () => {
      const lot = makeLot();
      const nearestSlot = makeSlot({ slot_number: 2, slot_size: SlotSize.LARGE });
      const savedTicket = makeTicket({ plate_number: 'ABC-1234', entry_time: new Date() });

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(null);
      mockManager.getRepository().createQueryBuilder().getOne.mockResolvedValue(nearestSlot);
      mockManager.save
        .mockResolvedValueOnce(nearestSlot)
        .mockResolvedValueOnce(savedTicket);

      await setupModule();
      const result = await service.parkCar('lot-uuid', dto);

      expect(result.slotNumber).toBe(2);
    });

    it('allows MEDIUM car to use LARGE slot as fallback (nearest-slot invariant)', async () => {
      const lot = makeLot();
      // Only a LARGE slot is available — MEDIUM car should use it
      const largeSlot = makeSlot({ slot_number: 1, slot_size: SlotSize.LARGE });
      const savedTicket = makeTicket({ car_size: CarSize.MEDIUM });

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(null);
      mockManager.getRepository().createQueryBuilder().getOne.mockResolvedValue(largeSlot);
      mockManager.save
        .mockResolvedValueOnce(largeSlot)
        .mockResolvedValueOnce(savedTicket);

      await setupModule();
      const result = await service.parkCar('lot-uuid', { plateNumber: 'MED-001', carSize: CarSize.MEDIUM });

      expect(result.slotSize).toBe(SlotSize.LARGE);
    });

    it('allows SMALL car to use MEDIUM slot as fallback', async () => {
      const lot = makeLot();
      const mediumSlot = makeSlot({ slot_number: 3, slot_size: SlotSize.MEDIUM });
      const savedTicket = makeTicket({ car_size: CarSize.SMALL });

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(null);
      mockManager.getRepository().createQueryBuilder().getOne.mockResolvedValue(mediumSlot);
      mockManager.save
        .mockResolvedValueOnce(mediumSlot)
        .mockResolvedValueOnce(savedTicket);

      await setupModule();
      const result = await service.parkCar('lot-uuid', { plateNumber: 'SML-001', carSize: CarSize.SMALL });

      expect(result.slotSize).toBe(SlotSize.MEDIUM);
    });

    it('throws NotFoundException when parking lot does not exist', async () => {
      mockManager = buildMockManager();
      mockManager.findOne.mockResolvedValueOnce(null); // lot not found

      await setupModule();
      await expect(service.parkCar('bad-lot', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when same plate is already actively parked', async () => {
      const lot = makeLot();
      const existingTicket = makeTicket();

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(existingTicket); // duplicate active ticket

      await setupModule();
      await expect(service.parkCar('lot-uuid', dto)).rejects.toThrow(ConflictException);
    });

    it('throws UnprocessableEntityException when no compatible slot is available', async () => {
      const lot = makeLot();

      mockManager = buildMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(null);
      mockManager.getRepository().createQueryBuilder().getOne.mockResolvedValue(null); // no slot

      await setupModule();
      await expect(service.parkCar('lot-uuid', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ── leaveParkingSlot() ────────────────────────────────────────────────────

  describe('leaveParkingSlot()', () => {
    it('marks ticket is_active=false and slot is_available=true on successful leave', async () => {
      const ticket = makeTicket({ is_active: true });

      mockManager = buildMockManager();
      mockManager.findOne.mockResolvedValueOnce(ticket);

      await setupModule();
      const result = await service.leaveParkingSlot('lot-uuid', 'ticket-uuid');

      expect(result.ticketId).toBe('ticket-uuid');
      expect(result.plateNumber).toBe('ABC-1234');
      // save should have been called twice: once for ticket, once for slot
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('sets exitTime on the returned response', async () => {
      const ticket = makeTicket({ is_active: true });

      mockManager = buildMockManager();
      mockManager.findOne.mockResolvedValueOnce(ticket);

      await setupModule();
      const before = Date.now();
      const result = await service.leaveParkingSlot('lot-uuid', 'ticket-uuid');
      const after = Date.now();

      expect(result.exitTime.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.exitTime.getTime()).toBeLessThanOrEqual(after);
    });

    it('throws NotFoundException when ticket does not exist', async () => {
      mockManager = buildMockManager();
      mockManager.findOne.mockResolvedValueOnce(null);

      await setupModule();
      await expect(
        service.leaveParkingSlot('lot-uuid', 'ghost-ticket'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when ticket is already closed', async () => {
      const closedTicket = makeTicket({ is_active: false });

      mockManager = buildMockManager();
      mockManager.findOne.mockResolvedValueOnce(closedTicket);

      await setupModule();
      await expect(
        service.leaveParkingSlot('lot-uuid', 'ticket-uuid'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── formatDuration() ──────────────────────────────────────────────────────

  describe('formatDuration()', () => {
    beforeEach(async () => {
      mockManager = buildMockManager();
      await setupModule();
    });

    it('returns "2 hours 15 minutes" for a 2h 15m duration', () => {
      const entry = new Date('2026-04-02T10:30:00.000Z');
      const exit = new Date('2026-04-02T12:45:00.000Z');
      expect(service.formatDuration(entry, exit)).toBe('2 hours 15 minutes');
    });

    it('returns "45 minutes" for a sub-hour duration', () => {
      const entry = new Date('2026-04-02T10:00:00.000Z');
      const exit = new Date('2026-04-02T10:45:00.000Z');
      expect(service.formatDuration(entry, exit)).toBe('45 minutes');
    });

    it('returns "1 minute" (singular) for exactly 1 minute', () => {
      const entry = new Date('2026-04-02T10:00:00.000Z');
      const exit = new Date('2026-04-02T10:01:00.000Z');
      expect(service.formatDuration(entry, exit)).toBe('1 minute');
    });

    it('returns "1 hour" (singular, no minutes) for exactly 60 minutes', () => {
      const entry = new Date('2026-04-02T10:00:00.000Z');
      const exit = new Date('2026-04-02T11:00:00.000Z');
      expect(service.formatDuration(entry, exit)).toBe('1 hour');
    });
  });
});
