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

  @Post('leave/:ticketId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'parkingLotId', description: 'UUID of the parking lot' })
  @ApiParam({ name: 'ticketId', description: 'UUID of the ticket to close' })
  @ApiOperation({ summary: 'Release a parking slot and close the ticket' })
  @ApiResponse({ status: 200, description: 'Slot released, exit summary returned' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 409, description: 'Ticket already closed (car already left)' })
  leaveParkingSlot(
    @Param('parkingLotId') parkingLotId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketService.leaveParkingSlot(parkingLotId, ticketId);
  }
}
