import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DeviceMaintenance,
  DeviceMaintenanceDocument,
  MaintenanceTypeLabels,
} from './device-maintenance.schema';
import { InjectModel as InjectDeviceModel } from '@nestjs/mongoose';
import { Device, DeviceDocument } from '../devices/device.schema';

@Injectable()
export class DevicesMaintenanceService {
  constructor(
    @InjectModel(DeviceMaintenance.name)
    private readonly maintenanceModel: Model<DeviceMaintenanceDocument>,
    @InjectDeviceModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
  ) {}

  async create(
    deviceId: string,
    startDate: string,
    endDate: string,
    maintenanceType?: string,
  ): Promise<DeviceMaintenance> {
    const device = await this.deviceModel.findById(deviceId).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const existing = await this.maintenanceModel.findOne({ deviceId: deviceId as any }).exec();
    if (existing) {
      throw new BadRequestException('Device already has a maintenance schedule');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const type = (maintenanceType || 'maintenance_preventive') as keyof typeof MaintenanceTypeLabels;

    const maintenance = new this.maintenanceModel({
      deviceId,
      startDate: start,
      endDate: end,
      maintenanceType: type,
      lastMaintenanceDate: null,
      nextMaintenanceDate: end,
      modifications: [
        {
          field: 'Création',
          oldValue: null,
          newValue: `Planning créé du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')} — ${MaintenanceTypeLabels[type] || type}`,
          date: new Date(),
          action: 'Création',
        },
      ],
    });

    return maintenance.save();
  }

  async findAll(
    month?: number,
    year?: number,
  ): Promise<any[]> {
    let query = this.maintenanceModel.find().populate('deviceId');

    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      query = query.where({
        nextMaintenanceDate: { $gte: startDate, $lte: endDate },
      });
    } else if (year !== undefined) {
      const startDate = new Date(year, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, 11, 31);
      endDate.setHours(23, 59, 59, 999);
      query = query.where({
        nextMaintenanceDate: { $gte: startDate, $lte: endDate },
      });
    }

    return query.sort({ nextMaintenanceDate: 1 }).exec();
  }

  async findByDeviceId(deviceId: string): Promise<DeviceMaintenance> {
    const maintenance = await this.maintenanceModel.findOne({ deviceId: deviceId as any }).exec();
    if (!maintenance) {
      throw new NotFoundException('Maintenance schedule not found for this device');
    }
    return maintenance;
  }

  async findById(id: string): Promise<any> {
    const maintenance = await this.maintenanceModel.findById(id).populate('deviceId').exec();
    if (!maintenance) {
      throw new NotFoundException('Maintenance schedule not found');
    }
    return maintenance;
  }

  async update(
    id: string,
    updateDto: { maintenanceType?: string; endDate?: string },
  ): Promise<any> {
    const maintenance = await this.maintenanceModel.findById(id).exec();
    if (!maintenance) {
      throw new NotFoundException('Maintenance schedule not found');
    }

    const mods: any[] = [];

    if (updateDto.maintenanceType && updateDto.maintenanceType !== maintenance.maintenanceType) {
      const oldLabel = MaintenanceTypeLabels[maintenance.maintenanceType] || maintenance.maintenanceType;
      const newLabel = MaintenanceTypeLabels[updateDto.maintenanceType as keyof typeof MaintenanceTypeLabels] || updateDto.maintenanceType;
      mods.push({
        field: 'Type de maintenance',
        oldValue: oldLabel,
        newValue: newLabel,
        date: new Date(),
        action: 'Modification',
      });
    }

    if (updateDto.endDate) {
      const end = new Date(updateDto.endDate);
      const oldEndStr = new Date(maintenance.endDate).toLocaleDateString('fr-FR');
      const newEndStr = end.toLocaleDateString('fr-FR');
      if (oldEndStr !== newEndStr) {
        mods.push({
          field: 'Date de fin',
          oldValue: oldEndStr,
          newValue: newEndStr,
          date: new Date(),
          action: 'Modification',
        });
      }
    }

    const payload: any = { $set: {} as any, $push: {} as any };

    if (updateDto.maintenanceType) payload.$set.maintenanceType = updateDto.maintenanceType;
    if (updateDto.endDate) {
      const end = new Date(updateDto.endDate);
      payload.$set.endDate = end;
      payload.$set.nextMaintenanceDate = end;
    }
    if (mods.length > 0) {
      payload.$push.modifications = { $each: mods };
    }

    const updateOps: any = {};
    if (Object.keys(payload.$set).length > 0) updateOps.$set = payload.$set;
    if (mods.length > 0) updateOps.$push = { modifications: { $each: mods } };

    return this.maintenanceModel.findByIdAndUpdate(id, updateOps, { returnDocument: 'after' }).exec();
  }

  async markAsMaintained(id: string): Promise<DeviceMaintenance> {
    const maintenance = await this.maintenanceModel.findById(id).exec();
    if (!maintenance) {
      throw new NotFoundException('Maintenance schedule not found');
    }

    const lastMaintenanceDate = new Date();
    const duration = maintenance.endDate.getTime() - maintenance.startDate.getTime();
    const nextEndDate = new Date(lastMaintenanceDate.getTime() + duration);

    const modification = {
      field: 'Maintenance effectuée',
      oldValue: `Fin prévue: ${new Date(maintenance.endDate).toLocaleDateString('fr-FR')}`,
      newValue: `Prochaine fin: ${nextEndDate.toLocaleDateString('fr-FR')}`,
      date: lastMaintenanceDate,
      action: 'Maintenance effectuée',
    };

    const updated = await this.maintenanceModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            lastMaintenanceDate,
            startDate: lastMaintenanceDate,
            endDate: nextEndDate,
            nextMaintenanceDate: nextEndDate,
          },
          $push: { modifications: modification },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Maintenance schedule not found');
    }

    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.maintenanceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Maintenance schedule not found');
    }
    return { message: 'Maintenance schedule deleted successfully' };
  }

  async getDevicesWithoutMaintenance(): Promise<any[]> {
    const maintenanceDeviceIds = await this.maintenanceModel.distinct('deviceId').exec();
    return this.deviceModel
      .find({ _id: { $nin: maintenanceDeviceIds } } as any)
      .exec();
  }
}
