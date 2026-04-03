import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ParkingLotService } from './parking-lot.service';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSlot } from './entities/parking-slot.entity';
import { SlotSize } from '../common/enums/slot-size.enum';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';

const mockParkingLotRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockParkingSlotRepository = () => ({});

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
  let dataSource: { transaction: jest.Mock };

  const fakeLot: Partial<ParkingLot> = {
    id: 'uuid-lot-1',
    name: 'Test Lot',
    total_slots: 5,
  };

  beforeEach(async () => {
    parkingLotRepo = mockParkingLotRepository();

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
          useValue: mockParkingSlotRepository(),
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
});
