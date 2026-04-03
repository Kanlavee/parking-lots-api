import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ParkingLotService } from './parking-lot.service';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSlot } from './entities/parking-slot.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { SlotSize } from '../common/enums/slot-size.enum';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';

const mockParkingLotRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockParkingSlotRepository = () => ({
  find: jest.fn(),
});

const mockTicketRepository = () => ({
  find: jest.fn(),
});

const buildMockManager = (savedLot: Partial<ParkingLot>) => ({
  create: jest.fn().mockReturnValue(savedLot),
  save: jest
    .fn()
    .mockImplementation((_entity: unknown, data: unknown) =>
      Promise.resolve(data),
    ),
});

const mockDataSource = (savedLot: Partial<ParkingLot>) => ({
  transaction: jest.fn().mockImplementation((cb: (manager: unknown) => unknown) =>
    cb(buildMockManager(savedLot)),
  ),
});

describe('ParkingLotService', () => {
  let service: ParkingLotService;
  let parkingLotRepo: ReturnType<typeof mockParkingLotRepository>;
  let parkingSlotRepo: ReturnType<typeof mockParkingSlotRepository>;
  let ticketRepo: ReturnType<typeof mockTicketRepository>;
  let dataSource: { transaction: jest.Mock };

  const fakeLot: Partial<ParkingLot> = {
    id: 'uuid-lot-1',
    name: 'Test Lot',
    total_slots: 5,
  };

  beforeEach(async () => {
    parkingLotRepo = mockParkingLotRepository();
    parkingSlotRepo = mockParkingSlotRepository();
    ticketRepo = mockTicketRepository();

    const ds = mockDataSource(fakeLot);
    dataSource = ds;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParkingLotService,
        {
          provide: getRepositoryToken(ParkingLot),
          useValue: parkingLotRepo,
        },
        {
          provide: getRepositoryToken(ParkingSlot),
          useValue: parkingSlotRepo,
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: ticketRepo,
        },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();

    service = module.get<ParkingLotService>(ParkingLotService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a parking lot and returns slot summary with LARGE slots first (lowest numbers)', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Main Parking',
        slots: [
          { size: SlotSize.SMALL, count: 2 },
          { size: SlotSize.LARGE, count: 1 },
          { size: SlotSize.MEDIUM, count: 2 },
        ],
      };

      const result = await service.create(dto);

      expect(result.totalSlots).toBe(5);
      expect(result.availableSlots).toBe(5);
      expect(result.name).toBe('Test Lot');

      // LARGE must come first in slotSummary with slot 1
      expect(result.slotSummary[0].size).toBe(SlotSize.LARGE);
      expect(result.slotSummary[0].slotNumbers).toBe('1');

      // MEDIUM must come second, slots 2-3
      expect(result.slotSummary[1].size).toBe(SlotSize.MEDIUM);
      expect(result.slotSummary[1].slotNumbers).toBe('2-3');

      // SMALL must come last, slots 4-5
      expect(result.slotSummary[2].size).toBe(SlotSize.SMALL);
      expect(result.slotSummary[2].slotNumbers).toBe('4-5');
    });

    it('throws BadRequestException when duplicate slot sizes are provided', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Bad Lot',
        slots: [
          { size: SlotSize.LARGE, count: 5 },
          { size: SlotSize.LARGE, count: 3 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      // transaction should NOT have been called
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('builds correct slotNumbers range string for single-slot groups', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Single Lot',
        slots: [{ size: SlotSize.LARGE, count: 1 }],
      };

      const result = await service.create(dto);

      expect(result.slotSummary[0].slotNumbers).toBe('1'); // not "1-1"
    });

    it('passes only the configured sizes to slotSummary (omits absent sizes)', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Partial Lot',
        slots: [{ size: SlotSize.MEDIUM, count: 3 }],
      };

      const result = await service.create(dto);

      expect(result.slotSummary).toHaveLength(1);
      expect(result.slotSummary[0].size).toBe(SlotSize.MEDIUM);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the parking lot when found', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);

      const result = await service.findOne('uuid-lot-1');

      expect(result).toEqual(fakeLot);
      expect(parkingLotRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-lot-1' },
      });
    });

    it('throws NotFoundException when parking lot does not exist', async () => {
      parkingLotRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('not-a-real-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getStatus() ───────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns lot status with available and occupied slots', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);

      const fakeSlots = [
        { id: 'slot-1', slot_number: 1, slot_size: SlotSize.LARGE, is_available: false },
        { id: 'slot-2', slot_number: 2, slot_size: SlotSize.MEDIUM, is_available: true },
      ];
      parkingSlotRepo.find.mockResolvedValue(fakeSlots);

      const fakeTicket = {
        plate_number: 'ABC123',
        car_size: 'LARGE',
        entry_time: new Date('2024-01-01T10:00:00Z'),
        parkingSlot: { id: 'slot-1' },
      };
      ticketRepo.find.mockResolvedValue([fakeTicket]);

      const result = await service.getStatus('uuid-lot-1');

      expect(result.parkingLotId).toBe('uuid-lot-1');
      expect(result.totalSlots).toBe(5);
      expect(result.availableSlots).toBe(1);
      expect(result.occupiedSlots).toBe(4);
      expect(result.slots).toHaveLength(2);

      const occupiedSlot = result.slots[0];
      expect(occupiedSlot.isAvailable).toBe(false);
      expect(occupiedSlot.currentCar).not.toBeNull();
      expect(occupiedSlot.currentCar!.plateNumber).toBe('ABC123');

      const freeSlot = result.slots[1];
      expect(freeSlot.isAvailable).toBe(true);
      expect(freeSlot.currentCar).toBeNull();
    });

    it('throws NotFoundException when parking lot does not exist', async () => {
      parkingLotRepo.findOne.mockResolvedValue(null);

      await expect(service.getStatus('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPlateNumbersByCarSize() ────────────────────────────────────────────

  describe('getPlateNumbersByCarSize()', () => {
    it('returns plate numbers for active tickets of given car size', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);
      ticketRepo.find.mockResolvedValue([
        { plate_number: 'AAA111', car_size: 'MEDIUM' },
        { plate_number: 'BBB222', car_size: 'MEDIUM' },
      ]);

      const result = await service.getPlateNumbersByCarSize('uuid-lot-1', 'MEDIUM' as any);

      expect(result.carSize).toBe('MEDIUM');
      expect(result.count).toBe(2);
      expect(result.plateNumbers).toEqual(['AAA111', 'BBB222']);
    });

    it('returns empty array when no cars of that size are parked', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);
      ticketRepo.find.mockResolvedValue([]);

      const result = await service.getPlateNumbersByCarSize('uuid-lot-1', 'LARGE' as any);

      expect(result.count).toBe(0);
      expect(result.plateNumbers).toEqual([]);
    });
  });

  // ── getSlotNumbersByCarSize() ─────────────────────────────────────────────

  describe('getSlotNumbersByCarSize()', () => {
    it('returns sorted slot numbers for active tickets of given car size', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);
      ticketRepo.find.mockResolvedValue([
        { car_size: 'SMALL', parkingSlot: { slot_number: 5 } },
        { car_size: 'SMALL', parkingSlot: { slot_number: 3 } },
      ]);

      const result = await service.getSlotNumbersByCarSize('uuid-lot-1', 'SMALL' as any);

      expect(result.carSize).toBe('SMALL');
      expect(result.count).toBe(2);
      expect(result.slotNumbers).toEqual([3, 5]); // sorted ascending
    });

    it('returns empty array when no cars of that size are parked', async () => {
      parkingLotRepo.findOne.mockResolvedValue(fakeLot);
      ticketRepo.find.mockResolvedValue([]);

      const result = await service.getSlotNumbersByCarSize('uuid-lot-1', 'LARGE' as any);

      expect(result.count).toBe(0);
      expect(result.slotNumbers).toEqual([]);
    });
  });
});
