import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSlot } from './entities/parking-slot.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { ParkingLotService } from './parking-lot.service';
import { ParkingLotController } from './parking-lot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParkingLot, ParkingSlot, Ticket])],
  controllers: [ParkingLotController],
  providers: [ParkingLotService],
  exports: [ParkingLotService],
})
export class ParkingLotModule {}
