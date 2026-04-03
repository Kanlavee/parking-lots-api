import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { CarSize } from '../../common/enums/car-size.enum';

export class ParkCarDto {
  @ApiProperty({
    example: 'ABC-1234',
    description: 'Vehicle registration plate number (case-insensitive, stored as uppercase)',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9\-]+$/, {
    message: 'plateNumber may only contain letters, digits, and hyphens',
  })
  plateNumber!: string;

  @ApiProperty({
    enum: CarSize,
    example: CarSize.MEDIUM,
    description: 'Size of the car to park',
  })
  @IsEnum(CarSize)
  carSize!: CarSize;
}
