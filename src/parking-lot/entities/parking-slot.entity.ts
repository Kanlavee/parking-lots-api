import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { SlotSize } from '../../common/enums/slot-size.enum';
import { ParkingLot } from './parking-lot.entity';

@Entity('parking_slots')
@Unique(['parkingLot', 'slot_number'])
@Index(['parkingLot', 'is_available', 'slot_size', 'slot_number'])
export class ParkingSlot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ParkingLot, (lot) => lot.slots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parking_lot_id' })
  parkingLot!: ParkingLot;

  @Column({ type: 'int', nullable: false })
  slot_number!: number;

  @Column({ type: 'enum', enum: SlotSize, nullable: false })
  slot_size!: SlotSize;

  @Column({ type: 'boolean', default: true })
  is_available!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
