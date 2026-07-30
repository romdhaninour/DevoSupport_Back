import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevicesMaintenanceService } from './devices-maintenance.service';

@Controller('devices-maintenance')
@UseGuards(JwtAuthGuard)
export class DevicesMaintenanceController {
  constructor(
    private readonly devicesMaintenanceService: DevicesMaintenanceService,
  ) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { deviceId: string; startDate: string; endDate: string; maintenanceType?: string },
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'IT') {
      return { error: 'Access denied' };
    }
    return this.devicesMaintenanceService.create(
      body.deviceId,
      body.startDate,
      body.endDate,
      body.maintenanceType,
    );
  }

  @Get()
  async findAll(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.devicesMaintenanceService.findAll(
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('devices-without')
  async getDevicesWithoutMaintenance() {
    return this.devicesMaintenanceService.getDevicesWithoutMaintenance();
  }

  @Get('record/:id')
  async findById(@Param('id') id: string) {
    return this.devicesMaintenanceService.findById(id);
  }

  @Get(':deviceId')
  async findOne(@Param('deviceId') deviceId: string) {
    return this.devicesMaintenanceService.findByDeviceId(deviceId);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { maintenanceType?: string; endDate?: string },
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'IT') {
      return { error: 'Access denied' };
    }
    return this.devicesMaintenanceService.update(id, body);
  }

  @Patch(':id/maintained')
  async markAsMaintained(@Req() req: any, @Param('id') id: string) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'IT') {
      return { error: 'Access denied' };
    }
    return this.devicesMaintenanceService.markAsMaintained(id);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'IT') {
      return { error: 'Access denied' };
    }
    return this.devicesMaintenanceService.remove(id);
  }
}
