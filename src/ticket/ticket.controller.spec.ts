import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

// Mock Swagger decorators — incompatible with Jest v30 + lodash UMD
jest.mock('@nestjs/swagger', () => ({
  ApiTags: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiResponse: () => () => undefined,
  ApiParam: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiQuery: () => () => undefined,
}));

import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { CarSize } from '../common/enums/car-size.enum';
import { SlotSize } from '../common/enums/slot-size.enum';
import { ParkCarDto } from './dto/park-car.dto';
import { ParkCarResponse } from './ticket.service';
import { LeaveResponseDto } from './dto/leave-response.dto';

const mockTicketService = () => ({
  parkCar: jest.fn(),
  leaveParkingSlot: jest.fn(),
});

describe('TicketController', () => {
  let controller: TicketController;
  let service: ReturnType<typeof mockTicketService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [{ provide: TicketService, useFactory: mockTicketService }],
    }).compile();

    controller = module.get<TicketController>(TicketController);
    service = module.get(TicketService);
  });

  // ── POST park ─────────────────────────────────────────────────────────────

  describe('POST /parking-lots/:parkingLotId/park', () => {
    it('returns 201 with ticket details when car is parked successfully', async () => {
      const dto: ParkCarDto = { plateNumber: 'ABC-1234', carSize: CarSize.MEDIUM };
      const expected: ParkCarResponse = {
        ticketId: 'ticket-uuid',
        plateNumber: 'ABC-1234',
        carSize: CarSize.MEDIUM,
        slotNumber: 11,
        slotSize: SlotSize.MEDIUM,
        entryTime: new Date('2026-04-02T10:30:00.000Z'),
      };

      service.parkCar.mockResolvedValue(expected);

      const result = await controller.parkCar('lot-uuid', dto);

      expect(result).toEqual(expected);
      expect(service.parkCar).toHaveBeenCalledWith('lot-uuid', dto);
    });

    it('propagates UnprocessableEntityException (422) when no compatible slot available', async () => {
      const dto: ParkCarDto = { plateNumber: 'BIG-001', carSize: CarSize.LARGE };

      service.parkCar.mockRejectedValue(
        new UnprocessableEntityException('No available slot for a LARGE car.'),
      );

      await expect(controller.parkCar('lot-uuid', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('propagates ConflictException (409) when plate is already parked', async () => {
      const dto: ParkCarDto = { plateNumber: 'DUP-001', carSize: CarSize.SMALL };

      service.parkCar.mockRejectedValue(
        new ConflictException('Vehicle DUP-001 is already parked.'),
      );

      await expect(controller.parkCar('lot-uuid', dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── POST leave ────────────────────────────────────────────────────────────

  describe('POST /parking-lots/:parkingLotId/leave/:ticketId', () => {
    it('returns 200 with exit summary when car leaves successfully', async () => {
      const entry = new Date('2026-04-02T10:30:00.000Z');
      const exit = new Date('2026-04-02T12:45:00.000Z');
      const expected: LeaveResponseDto = {
        ticketId: 'ticket-uuid',
        plateNumber: 'ABC-1234',
        carSize: CarSize.MEDIUM,
        slotNumber: 11,
        entryTime: entry,
        exitTime: exit,
        duration: '2 hours 15 minutes',
      };

      service.leaveParkingSlot.mockResolvedValue(expected);

      const result = await controller.leaveParkingSlot('lot-uuid', 'ticket-uuid');

      expect(result).toEqual(expected);
      expect(service.leaveParkingSlot).toHaveBeenCalledWith('lot-uuid', 'ticket-uuid');
    });

    it('propagates ConflictException (409) when ticket is already closed', async () => {
      service.leaveParkingSlot.mockRejectedValue(
        new ConflictException('Ticket already closed — the car has already left.'),
      );

      await expect(
        controller.leaveParkingSlot('lot-uuid', 'closed-ticket'),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException (404) when ticket does not exist', async () => {
      service.leaveParkingSlot.mockRejectedValue(
        new NotFoundException('Ticket not found.'),
      );

      await expect(
        controller.leaveParkingSlot('lot-uuid', 'ghost-ticket'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
