import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CarSize } from '../../common/enums/car-size.enum';
import { ParkingLot } from '../../parking-lot/entities/parking-lot.entity';
import { ParkingSlot } from '../../parking-lot/entities/parking-slot.entity';

@Entity('tickets')
@Index(['parkingLot', 'is_active'])
@Index(['parkingSlot', 'is_active'])
@Index(['plate_number', 'is_active'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ParkingLot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parking_lot_id' })
  parkingLot!: ParkingLot;

  @ManyToOne(() => ParkingSlot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parking_slot_id' })
  parkingSlot!: ParkingSlot;

  @Column({ type: 'varchar', length: 20, nullable: false })
  plate_number!: string;

  @Column({ type: 'enum', enum: CarSize, nullable: false })
  car_size!: CarSize;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  entry_time!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  exit_time!: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
