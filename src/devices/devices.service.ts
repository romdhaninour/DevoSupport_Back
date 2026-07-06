import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument, DeviceStatus, DeviceType } from './device.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';
import * as ExcelJS from 'exceljs';

export function normalizeDeviceStatus(rawValue: string): DeviceStatus | null {
  const normalized = (rawValue || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  if (normalized === '' || normalized === 'available' || normalized === 'disponible' || normalized === 'dispo') {
    return 'available';
  }
  if (
    normalized === 'assigned' ||
    normalized === 'assigne' ||
    normalized.includes('assign') ||
    normalized.includes('attrib')
  ) {
    return 'assigned';
  }
  if (normalized === 'maintenance' || normalized === 'en maintenance') {
    return 'maintenance';
  }
  if (
    normalized === 'retired' ||
    normalized === 'retire' ||
    normalized.includes('retir') ||
    normalized.includes('retraite')
  ) {
    return 'retired';
  }

  return null;
}

export function formatDeviceStatusForExport(status: DeviceStatus): string {
  switch (status) {
    case 'assigned':
      return 'Assigné';
    case 'maintenance':
      return 'Maintenance';
    case 'retired':
      return 'Retiré';
    default:
      return 'Disponible';
  }
}

export interface CreateDeviceDto {
  name: string;
  type: DeviceType;
  department: string;
  owner: string;
  email?: string;
  status?: DeviceStatus;
  location: string;
  serialNumber: string;
  purchaseDate?: string;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const status = normalizeDeviceStatus(createDeviceDto.status || 'available') || 'available';
    const payload = {
      ...createDeviceDto,
      status,
      department: createDeviceDto.department || 'Non spécifié',
      owner: createDeviceDto.owner || 'À définir',
      email: createDeviceDto.email || '',
      location: createDeviceDto.location || 'À définir',
      serialNumber: createDeviceDto.serialNumber || `AUTO-${Date.now()}`,
    };
    const createdDevice = new this.deviceModel(payload);
    return createdDevice.save();
  }

  async findAll(page?: string, limit?: string, search?: string): Promise<{ devices: Device[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const skip = (pageNum - 1) * limitNum;

    let query = this.deviceModel.find();

    if (search) {
      query = query.or([
        { name: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { owner: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ]);
    }

    const [devices, total] = await Promise.all([
      query.clone().sort({ createdAt: -1 }).skip(skip).limit(limitNum).exec(),
      query.clone().countDocuments().exec(),
    ]);

    return { devices, total, page: pageNum, limit: limitNum };
  }

  async findAssigned(userId: string, role: Role, page?: string, limit?: string, search?: string, forUserId?: string): Promise<{ devices: Device[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { status: 'assigned' };
    if (role === Role.CONSULTANT || !forUserId) {
      // consultants and IT/Admin without explicit userId query see their own assigned devices
      filter.assignedTo = userId;
    } else if (forUserId) {
      // IT/Admin may request devices for a specific consultant via query param
      filter.assignedTo = forUserId;
    }

    let query = this.deviceModel.find(filter);

    if (search) {
      query = query.or([
        { name: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { owner: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ]);
    }

    const [devices, total] = await Promise.all([
      query.clone().sort({ createdAt: -1 }).skip(skip).limit(limitNum).exec(),
      query.clone().countDocuments().exec(),
    ]);

    return { devices, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async findOneForUser(userId: string, role: Role, id: string): Promise<Device> {
    const device = await this.findOne(id);

    if (role === Role.CONSULTANT) {
      if (!device.assignedTo || device.assignedTo.toString() !== userId) {
        throw new ForbiddenException('Access denied to this device');
      }
    }

    return device;
  }

  async update(id: string, updateDeviceDto: Partial<CreateDeviceDto>): Promise<Device> {
    const device = await this.deviceModel.findByIdAndUpdate(id, updateDeviceDto, { returnDocument: 'after' }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async updateStatus(id: string, updateStatusDto: { status: DeviceStatus }): Promise<Device> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const transitionAllowed =
      (device.status === 'available' && updateStatusDto.status === 'maintenance') ||
      (device.status === 'maintenance' && updateStatusDto.status === 'available');

    if (!transitionAllowed) {
      throw new BadRequestException('Only available <-> maintenance transitions are allowed from this action');
    }

    const updated = await this.deviceModel.findByIdAndUpdate(id, {
      status: updateStatusDto.status,
      assignedTo: updateStatusDto.status === 'available' ? null : device.assignedTo,
      assignedAt: updateStatusDto.status === 'available' ? null : device.assignedAt,
      assignedBy: updateStatusDto.status === 'available' ? null : device.assignedBy,
    }, { returnDocument: 'after' }).exec();

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    return updated;
  }

  async allocateDevice(deviceId: string, consultantId: string, assignedBy?: string): Promise<Device> {
    try {
      const device = await this.deviceModel.findById(deviceId).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }

      if (device.status !== 'available') {
        throw new BadRequestException('Only available devices can be allocated');
      }

      let consultant;
      try {
        consultant = await this.usersService.findOne(consultantId);
      } catch (err) {
        if (consultantId.includes('@')) {
          consultant = await this.usersService.findByEmail(consultantId);
        }
      }

      if (!consultant || (consultant.role !== Role.CONSULTANT && consultant.role !== Role.IT && consultant.role !== Role.ADMIN)) {
        throw new BadRequestException('Selected consultant is not valid');
      }

      const updated = await this.deviceModel.findByIdAndUpdate(deviceId, {
        status: 'assigned',
        assignedTo: consultant._id?.toString() || consultantId,
        assignedAt: new Date(),
        assignedBy: assignedBy ?? null,
      }, { returnDocument: 'after' }).exec();

      if (!updated) {
        throw new NotFoundException('Device not found');
      }

      return updated;
    } catch (error) {
      console.error('ALLOCATE_DEVICE_ERROR', { deviceId, consultantId, assignedBy, error });
      throw error;
    }
  }

  async returnDevice(deviceId: string): Promise<Device> {
    const device = await this.deviceModel.findById(deviceId).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.status !== 'assigned') {
      throw new BadRequestException('Only assigned devices can be returned');
    }

    const updated = await this.deviceModel.findByIdAndUpdate(deviceId, {
      status: 'available',
      assignedTo: null,
      assignedAt: null,
      assignedBy: null,
    }, { returnDocument: 'after' }).exec();

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.deviceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Device not found');
    }
    return { message: 'Device deleted successfully' };
  }

  async addPhoto(deviceId: string, photoUrl: string): Promise<Device> {
    const updated = await this.deviceModel.findByIdAndUpdate(deviceId, { $push: { photos: photoUrl } }, { returnDocument: 'after' }).exec();
    if (!updated) {
      throw new NotFoundException('Device not found');
    }
    return updated;
  }

  async importDevices(file: any): Promise<{ success: number; failed: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('No worksheet found in the file');
    }

    const devices: CreateDeviceDto[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const name = row.getCell(1).value?.toString()?.trim();
      const type = row.getCell(2).value?.toString()?.trim();
      const serialNumber = row.getCell(3).value?.toString()?.trim();
      const rawStatus = row.getCell(4).value?.toString()?.trim();
      const status = normalizeDeviceStatus(rawStatus || 'available');
      const department = row.getCell(5).value?.toString()?.trim() || '';
      const owner = row.getCell(6).value?.toString()?.trim() || '';
      const location = row.getCell(7).value?.toString()?.trim() || '';

      if (!name || !type || !serialNumber) {
        errors.push(`Row ${rowNumber}: Missing required fields (name, type, serialNumber)`);
        failedCount++;
        return;
      }

      if (!status) {
        errors.push(
          `Row ${rowNumber}: Status "${rawStatus || 'empty'}" is not recognized. Valid values: Disponible/Available, Assigné/Assigned, Maintenance, Retiré/Retired`
        );
        failedCount++;
        return;
      }

      devices.push({
        name,
        type: type as DeviceType,
        serialNumber,
        status,
        department,
        owner,
        location,
      });
      successCount++;
    });

    for (const device of devices) {
      try {
        await this.create(device);
      } catch (error: any) {
        errors.push(`Failed to create device "${device.name}": ${error.message}`);
        failedCount++;
        successCount--;
      }
    }

    return { success: successCount, failed: failedCount, errors };
  }

  async exportDevices(search?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Devices');

    // Define columns
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Get devices with optional search filter
    let query = this.deviceModel.find();
    if (search) {
      query = query.or([
        { name: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
      ]);
    }
    const devices = await query.sort({ createdAt: -1 }).exec();

    // Add data rows
    devices.forEach((device, index) => {
      const row = worksheet.addRow({
        name: device.name,
        type: device.type,
        serialNumber: device.serialNumber,
        status: formatDeviceStatusForExport(device.status),
        department: device.department || '',
        owner: device.owner || '',
        location: device.location || '',
        purchaseDate: device.purchaseDate || '',
      });

      // Zebra striping
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }

      // Status color coding
      const statusCell = row.getCell(4);
      if (device.status === 'available') {
        statusCell.font = { color: { argb: 'FF00B050' } };
      } else if (device.status === 'assigned') {
        statusCell.font = { color: { argb: 'FF0070C0' } };
      } else if (device.status === 'maintenance') {
        statusCell.font = { color: { argb: 'FFFFC000' } };
      } else if (device.status === 'retired') {
        statusCell.font = { color: { argb: 'FFC00000' } };
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
