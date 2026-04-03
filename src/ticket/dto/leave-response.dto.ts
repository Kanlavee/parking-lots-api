import { ApiProperty } from '@nestjs/swagger';
import { CarSize } from '../../common/enums/car-size.enum';

export class LeaveResponseDto {
  @ApiProperty({ example: 'uuid-ticket' })
  ticketId!: string;

  @ApiProperty({ example: 'ABC-1234' })
  plateNumber!: string;

  @ApiProperty({ enum: CarSize, example: CarSize.MEDIUM })
  carSize!: CarSize;

  @ApiProperty({ example: 11 })
  slotNumber!: number;

  @ApiProperty({ example: '2026-04-02T10:30:00.000Z' })
  entryTime!: Date;

  @ApiProperty({ example: '2026-04-02T12:45:00.000Z' })
  exitTime!: Date;

  @ApiProperty({ example: '2 hours 15 minutes' })
  duration!: string;
}
