import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

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
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { CreateParkingLotResponse } from './parking-lot.service';

const mockParkingLotService = () => ({
  create: jest.fn(),
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
});
