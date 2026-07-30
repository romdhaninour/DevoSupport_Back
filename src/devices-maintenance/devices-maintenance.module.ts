import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DeviceMaintenance,
  DeviceMaintenanceSchema,
} from './device-maintenance.schema';
import { DevicesMaintenanceService } from './devices-maintenance.service';
import { DevicesMaintenanceController } from './devices-maintenance.controller';
import { Device, DeviceSchema } from '../devices/device.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceMaintenance.name, schema: DeviceMaintenanceSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
  ],
  controllers: [DevicesMaintenanceController],
  providers: [DevicesMaintenanceService],
  exports: [DevicesMaintenanceService],
})
export class DevicesMaintenanceModule {}
