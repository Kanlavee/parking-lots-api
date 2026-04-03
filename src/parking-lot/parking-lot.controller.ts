import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ParkingLotService } from './parking-lot.service';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';

@ApiTags('Parking Lots')
@Controller('parking-lots')
export class ParkingLotController {
  constructor(private readonly parkingLotService: ParkingLotService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new parking lot with sized slot groups' })
  @ApiResponse({ status: 201, description: 'Parking lot created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate slot sizes' })
  create(@Body() dto: CreateParkingLotDto) {
    return this.parkingLotService.create(dto);
  }
}
