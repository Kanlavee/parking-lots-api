import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SlotConfigDto } from './slot-config.dto';

export class CreateParkingLotDto {
  @ApiProperty({
    example: 'Main Parking',
    description: 'Name of the parking lot',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    type: [SlotConfigDto],
    description:
      'Array of slot size configurations. Each size (SMALL/MEDIUM/LARGE) may appear at most once.',
    example: [
      { size: 'LARGE', count: 10 },
      { size: 'MEDIUM', count: 20 },
      { size: 'SMALL', count: 20 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SlotConfigDto)
  slots!: SlotConfigDto[];
}
