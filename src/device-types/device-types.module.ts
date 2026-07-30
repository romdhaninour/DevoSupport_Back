import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeviceTypesController } from './device-types.controller';
import { DeviceTypesService } from './device-types.service';
import { DeviceTypeEntry, DeviceTypeSchema } from './device-type.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeviceTypeEntry.name, schema: DeviceTypeSchema }]),
  ],
  controllers: [DeviceTypesController],
  providers: [DeviceTypesService],
  exports: [DeviceTypesService],
})
export class DeviceTypesModule implements OnModuleInit {
  constructor(private readonly deviceTypesService: DeviceTypesService) {}

  async onModuleInit() {
    await this.deviceTypesService.seed();
  }
}
