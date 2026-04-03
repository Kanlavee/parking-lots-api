import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { ParkCarDto } from './dto/park-car.dto';

@ApiTags('Tickets')
@Controller('parking-lots/:parkingLotId')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('park')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'parkingLotId', description: 'UUID of the parking lot' })
  @ApiOperation({ summary: 'Park a car — allocates the nearest compatible slot' })
  @ApiResponse({ status: 201, description: 'Car parked successfully, ticket issued' })
  @ApiResponse({ status: 404, description: 'Parking lot not found' })
  @ApiResponse({ status: 409, description: 'Plate number is already parked' })
  @ApiResponse({ status: 422, description: 'No available slot for this car size' })
  parkCar(
    @Param('parkingLotId') parkingLotId: string,
    @Body() dto: ParkCarDto,
  ) {
    return this.ticketService.parkCar(parkingLotId, dto);
  }
}
