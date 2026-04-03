import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { SlotSize } from '../../common/enums/slot-size.enum';

export class SlotConfigDto {
  @ApiProperty({
    enum: SlotSize,
    example: SlotSize.LARGE,
    description: 'Size of the parking slot group',
  })
  @IsEnum(SlotSize)
  size!: SlotSize;

  @ApiProperty({
    example: 10,
    description: 'Number of slots of this size to create (minimum 1)',
  })
  @IsInt()
  @Min(1)
  count!: number;
}
