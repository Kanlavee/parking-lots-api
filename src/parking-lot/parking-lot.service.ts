import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSlot } from './entities/parking-slot.entity';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { SlotSize } from '../common/enums/slot-size.enum';

export interface SlotSummaryItem {
  size: SlotSize;
  count: number;
  slotNumbers: string;
}

export interface CreateParkingLotResponse {
  id: string;
  name: string;
  totalSlots: number;
  availableSlots: number;
  slotSummary: SlotSummaryItem[];
}

@Injectable()
export class ParkingLotService {
  constructor(
    @InjectRepository(ParkingLot)
    private readonly parkingLotRepository: Repository<ParkingLot>,
    @InjectRepository(ParkingSlot)
    private readonly parkingSlotRepository: Repository<ParkingSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateParkingLotDto,
  ): Promise<CreateParkingLotResponse> {
    // Validate: no duplicate sizes in the request
    const sizes = dto.slots.map((s) => s.size);
    const uniqueSizes = new Set(sizes);
    if (uniqueSizes.size !== sizes.length) {
      throw new BadRequestException(
        'Duplicate slot sizes provided. Each size (SMALL/MEDIUM/LARGE) can only appear once.',
      );
    }

    // Validate: total slots must be > 0 (each count is already >= 1 via DTO)
    const totalSlots = dto.slots.reduce((sum, s) => sum + s.count, 0);
    if (totalSlots === 0) {
      throw new BadRequestException('Total slot count must be greater than 0.');
    }

    return this.dataSource.transaction(async (manager) => {
      // Create parking lot
      const lot = manager.create(ParkingLot, {
        name: dto.name,
        total_slots: totalSlots,
      });
      const savedLot = await manager.save(ParkingLot, lot);

      // Create slots in LARGE → MEDIUM → SMALL order
      // This ensures the nearest slots (lowest numbers) accept the widest range of cars
      const sizeOrder: SlotSize[] = [
        SlotSize.LARGE,
        SlotSize.MEDIUM,
        SlotSize.SMALL,
      ];

      const slotSummary: SlotSummaryItem[] = [];
      let slotNumber = 1;

      const slotsToInsert: Partial<ParkingSlot>[] = [];

      for (const size of sizeOrder) {
        const config = dto.slots.find((s) => s.size === size);
        if (!config) continue;

        const startSlot = slotNumber;

        for (let i = 0; i < config.count; i++) {
          slotsToInsert.push({
            parkingLot: savedLot,
            slot_number: slotNumber,
            slot_size: size,
            is_available: true,
          });
          slotNumber++;
        }

        const endSlot = slotNumber - 1;
        slotSummary.push({
          size,
          count: config.count,
          slotNumbers:
            startSlot === endSlot
              ? `${startSlot}`
              : `${startSlot}-${endSlot}`,
        });
      }

      await manager.save(ParkingSlot, slotsToInsert as ParkingSlot[]);

      return {
        id: savedLot.id,
        name: savedLot.name,
        totalSlots,
        availableSlots: totalSlots,
        slotSummary,
      };
    });
  }

  async findOne(id: string): Promise<ParkingLot> {
    const lot = await this.parkingLotRepository.findOne({ where: { id } });
    if (!lot) {
      throw new NotFoundException(`Parking lot with id "${id}" not found.`);
    }
    return lot;
  }
}
