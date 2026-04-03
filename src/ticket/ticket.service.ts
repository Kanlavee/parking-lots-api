import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { ParkingLot } from '../parking-lot/entities/parking-lot.entity';
import { ParkingSlot } from '../parking-lot/entities/parking-slot.entity';
import { ParkCarDto } from './dto/park-car.dto';
import { CarSize } from '../common/enums/car-size.enum';
import { SlotSize } from '../common/enums/slot-size.enum';

export interface ParkCarResponse {
  ticketId: string;
  plateNumber: string;
  carSize: CarSize;
  slotNumber: number;
  slotSize: SlotSize;
  entryTime: Date;
}

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly dataSource: DataSource,
  ) {}

  private getCompatibleSlotSizes(carSize: CarSize): SlotSize[] {
    const map: Record<CarSize, SlotSize[]> = {
      [CarSize.LARGE]: [SlotSize.LARGE],
      [CarSize.MEDIUM]: [SlotSize.LARGE, SlotSize.MEDIUM],
      [CarSize.SMALL]: [SlotSize.LARGE, SlotSize.MEDIUM, SlotSize.SMALL],
    };
    return map[carSize];
  }

  async parkCar(
    parkingLotId: string,
    dto: ParkCarDto,
  ): Promise<ParkCarResponse> {
    const plateNumber = dto.plateNumber.toUpperCase();

    return this.dataSource.transaction(async (manager) => {
      // 1. Check parking lot exists
      const lot = await manager.findOne(ParkingLot, {
        where: { id: parkingLotId },
      });
      if (!lot) {
        throw new NotFoundException(
          `Parking lot with id "${parkingLotId}" not found.`,
        );
      }

      // 2. Check plate not already parked (is_active = true)
      const existingTicket = await manager.findOne(Ticket, {
        where: { plate_number: plateNumber, is_active: true },
      });
      if (existingTicket) {
        throw new ConflictException(
          `Vehicle "${plateNumber}" is already parked. Please leave first.`,
        );
      }

      // 3. Find nearest available compatible slot WITH pessimistic_write lock
      // Ordered by slot_number ASC to ensure "nearest to entry" invariant
      const compatibleSizes = this.getCompatibleSlotSizes(dto.carSize);
      const slot = await manager
        .getRepository(ParkingSlot)
        .createQueryBuilder('slot')
        .where('slot.parking_lot_id = :lotId', { lotId: parkingLotId })
        .andWhere('slot.is_available = :available', { available: true })
        .andWhere('slot.slot_size IN (:...sizes)', { sizes: compatibleSizes })
        .orderBy('slot.slot_number', 'ASC')
        .setLock('pessimistic_write')
        .getOne();

      if (!slot) {
        throw new UnprocessableEntityException(
          `No available slot for a ${dto.carSize} car in parking lot "${lot.name}".`,
        );
      }

      // 4. Mark slot as unavailable
      slot.is_available = false;
      await manager.save(ParkingSlot, slot);

      // 5. Create and return ticket
      const ticket = manager.create(Ticket, {
        parkingLot: lot,
        parkingSlot: slot,
        plate_number: plateNumber,
        car_size: dto.carSize,
        is_active: true,
      });
      const savedTicket = await manager.save(Ticket, ticket);

      return {
        ticketId: savedTicket.id,
        plateNumber: savedTicket.plate_number,
        carSize: savedTicket.car_size,
        slotNumber: slot.slot_number,
        slotSize: slot.slot_size,
        entryTime: savedTicket.entry_time,
      };
    });
  }
}
