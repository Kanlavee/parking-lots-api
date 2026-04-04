import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseEnumPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ParkingLotService } from './parking-lot.service';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { CarSize } from '../common/enums/car-size.enum';

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

  @Get(':parkingLotId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full status of a parking lot including per-slot occupancy' })
  @ApiParam({ name: 'parkingLotId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max slots to return (default 100)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of slots to skip (default 0)' })
  @ApiResponse({ status: 200, description: 'Parking lot status with slot details' })
  @ApiResponse({ status: 404, description: 'Parking lot not found' })
  getStatus(
    @Param('parkingLotId') parkingLotId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.parkingLotService.getStatus(parkingLotId, limit, offset);
  }

  @Get(':parkingLotId/cars')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get plate numbers of currently parked cars filtered by car size' })
  @ApiParam({ name: 'parkingLotId', type: String })
  @ApiQuery({ name: 'size', enum: CarSize })
  @ApiResponse({ status: 200, description: 'Plate numbers for the given car size' })
  @ApiResponse({ status: 404, description: 'Parking lot not found' })
  getPlateNumbers(
    @Param('parkingLotId') parkingLotId: string,
    @Query('size', new ParseEnumPipe(CarSize)) size: CarSize,
  ) {
    return this.parkingLotService.getPlateNumbersByCarSize(parkingLotId, size);
  }

  @Get(':parkingLotId/slots')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get slot numbers currently occupied by a specific car size' })
  @ApiParam({ name: 'parkingLotId', type: String })
  @ApiQuery({ name: 'size', enum: CarSize })
  @ApiResponse({ status: 200, description: 'Slot numbers for the given car size' })
  @ApiResponse({ status: 404, description: 'Parking lot not found' })
  getSlotNumbers(
    @Param('parkingLotId') parkingLotId: string,
    @Query('size', new ParseEnumPipe(CarSize)) size: CarSize,
  ) {
    return this.parkingLotService.getSlotNumbersByCarSize(parkingLotId, size);
  }
}
