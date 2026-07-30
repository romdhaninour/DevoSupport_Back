import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeviceTypeEntry, DeviceTypeDocument } from './device-type.schema';

@Injectable()
export class DeviceTypesService {
  constructor(
    @InjectModel(DeviceTypeEntry.name) private deviceTypeModel: Model<DeviceTypeDocument>,
  ) {}

  async create(name: string, description?: string): Promise<DeviceTypeEntry> {
    const existing = await this.deviceTypeModel.findOne({ name: name.trim() });
    if (existing) {
      throw new ConflictException('Ce type existe déjà');
    }
    return this.deviceTypeModel.create({ name: name.trim(), description: description || '' });
  }

  async findAll(sortOrder?: string): Promise<DeviceTypeEntry[]> {
    let sort: Record<string, 1 | -1>;
    if (sortOrder === 'desc') {
      sort = { createdAt: -1 };
    } else if (sortOrder === 'asc') {
      sort = { createdAt: 1 };
    } else {
      sort = { name: 1 };
    }
    return this.deviceTypeModel.find().sort(sort).exec();
  }

  async findOne(id: string): Promise<DeviceTypeEntry> {
    const doc = await this.deviceTypeModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Type non trouvé');
    return doc;
  }

  async update(id: string, name: string, description?: string): Promise<DeviceTypeEntry> {
    const doc = await this.deviceTypeModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Type non trouvé');

    const duplicate = await this.deviceTypeModel.findOne({ name: name.trim(), _id: { $ne: id } });
    if (duplicate) {
      throw new ConflictException('Ce type existe déjà');
    }

    doc.name = name.trim();
    if (description !== undefined) doc.description = description;
    return doc.save();
  }

  async remove(id: string): Promise<{ message: string }> {
    const doc = await this.deviceTypeModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Type non trouvé');
    return { message: 'Type supprimé avec succès' };
  }

  async seed(): Promise<void> {
    const count = await this.deviceTypeModel.countDocuments().exec();
    if (count === 0) {
      const defaults = [
        'Laptop', 'Desktop', 'Mobile', 'Tablet', 'Printer', 'Scanner',
        'Monitor', 'Router', 'Switch', 'Access Point', 'Camera', 'Projecteur',
      ];
      await this.deviceTypeModel.insertMany(
        defaults.map(name => ({ name, description: '' })),
      );
    }
  }
}
