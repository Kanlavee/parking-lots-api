import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock Swagger decorators — they are metadata-only and incompatible with Jest v30 + lodash UMD
jest.mock('@nestjs/swagger', () => ({
  ApiTags: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiResponse: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiParam: () => () => undefined,
  ApiQuery: () => () => undefined,
}));

import { ParkingLotController } from './parking-lot.controller';
import { ParkingLotService } from './parking-lot.service';
import { SlotSize } from '../common/enums/slot-size.enum';
import { CarSize } from '../common/enums/car-size.enum';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import {
  CreateParkingLotResponse,
  ParkingLotStatusResponse,
  PlatesByCarSizeResponse,
  SlotsByCarSizeResponse,
} from './parking-lot.service';

const mockParkingLotService = () => ({
  create: jest.fn(),
  getStatus: jest.fn(),
  getPlateNumbersByCarSize: jest.fn(),
  getSlotNumbersByCarSize: jest.fn(),
});

describe('ParkingLotController', () => {
  let controller: ParkingLotController;
  let service: ReturnType<typeof mockParkingLotService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParkingLotController],
      providers: [
        { provide: ParkingLotService, useFactory: mockParkingLotService },
      ],
    }).compile();

    controller = module.get<ParkingLotController>(ParkingLotController);
    service = module.get(ParkingLotService);
  });

  describe('POST /parking-lots', () => {
    it('returns 201 with the created parking lot response', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Main Parking',
        slots: [
          { size: SlotSize.LARGE, count: 10 },
          { size: SlotSize.MEDIUM, count: 20 },
          { size: SlotSize.SMALL, count: 20 },
        ],
      };

      const expected: CreateParkingLotResponse = {
        id: 'uuid-123',
        name: 'Main Parking',
        totalSlots: 50,
        availableSlots: 50,
        slotSummary: [
          { size: SlotSize.LARGE, count: 10, slotNumbers: '1-10' },
          { size: SlotSize.MEDIUM, count: 20, slotNumbers: '11-30' },
          { size: SlotSize.SMALL, count: 20, slotNumbers: '31-50' },
        ],
      };

      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('propagates BadRequestException from service when input is invalid', async () => {
      const dto: CreateParkingLotDto = {
        name: 'Bad Lot',
        slots: [
          { size: SlotSize.LARGE, count: 5 },
          { size: SlotSize.LARGE, count: 3 },
        ],
      };

      service.create.mockRejectedValue(
        new BadRequestException('Duplicate slot sizes provided.'),
      );

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /parking-lots/:parkingLotId/status', () => {
    it('delegates to service.getStatus and returns the result', async () => {
      const expected: ParkingLotStatusResponse = {
        parkingLotId: 'uuid-lot-1',
        name: 'Test Lot',
        totalSlots: 2,
        availableSlots: 1,
        occupiedSlots: 1,
        slots: [
          {
            slotNumber: 1,
            slotSize: SlotSize.LARGE,
            isAvailable: false,
            currentCar: {
              plateNumber: 'ABC123',
              carSize: CarSize.LARGE,
              entryTime: new Date('2024-01-01T10:00:00Z'),
            },
          },
          {
            slotNumber: 2,
            slotSize: SlotSize.MEDIUM,
            isAvailable: true,
            currentCar: null,
          },
        ],
      };

      service.getStatus.mockResolvedValue(expected);

      const result = await controller.getStatus('uuid-lot-1');

      expect(result).toEqual(expected);
      expect(service.getStatus).toHaveBeenCalledWith('uuid-lot-1');
    });

    it('propagates NotFoundException when lot does not exist', async () => {
      service.getStatus.mockRejectedValue(new NotFoundException());

      await expect(controller.getStatus('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /parking-lots/:parkingLotId/cars', () => {
    it('delegates to service.getPlateNumbersByCarSize and returns the result', async () => {
      const expected: PlatesByCarSizeResponse = {
        carSize: CarSize.MEDIUM,
        count: 2,
        plateNumbers: ['AAA111', 'BBB222'],
      };

      service.getPlateNumbersByCarSize.mockResolvedValue(expected);

      const result = await controller.getPlateNumbers('uuid-lot-1', CarSize.MEDIUM);

      expect(result).toEqual(expected);
      expect(service.getPlateNumbersByCarSize).toHaveBeenCalledWith('uuid-lot-1', CarSize.MEDIUM);
    });
  });

  describe('GET /parking-lots/:parkingLotId/slots', () => {
    it('delegates to service.getSlotNumbersByCarSize and returns the result', async () => {
      const expected: SlotsByCarSizeResponse = {
        carSize: CarSize.SMALL,
        count: 2,
        slotNumbers: [3, 5],
      };

      service.getSlotNumbersByCarSize.mockResolvedValue(expected);

      const result = await controller.getSlotNumbers('uuid-lot-1', CarSize.SMALL);

      expect(result).toEqual(expected);
      expect(service.getSlotNumbersByCarSize).toHaveBeenCalledWith('uuid-lot-1', CarSize.SMALL);
    });
  });
});
