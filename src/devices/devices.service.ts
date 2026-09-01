import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Device,
  DeviceDocument,
  DeviceStatus,
  DeviceType,
  MaintenanceFrequency,
  MaintenanceFrequencyLabels,
} from './device.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationRecipientRole } from '../notifications/notification.schema';
import * as ExcelJS from 'exceljs';

export function normalizeDeviceStatus(rawValue: string): DeviceStatus | null {
  const normalized = (rawValue || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  if (
    normalized === '' ||
    normalized === 'available' ||
    normalized === 'disponible' ||
    normalized === 'dispo'
  ) {
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
  maintenanceEnabled?: boolean;
  maintenanceType?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceFrequency?: string;
}

@Injectable()
export class DevicesService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onApplicationBootstrap() {
    setTimeout(() => this.checkMaintenanceDueDates(), 15000);
    setInterval(() => this.checkMaintenanceDueDates(), 60 * 60 * 1000);
  }

  private async checkMaintenanceDueDates() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      const devices = await this.deviceModel.find({
        maintenanceEnabled: true,
        maintenanceEndDate: { $gte: today, $lt: dayAfter },
      }).exec();

      for (const device of devices) {
        const isToday = device.maintenanceEndDate && device.maintenanceEndDate >= today && device.maintenanceEndDate < tomorrow;

        const existingNotif = await this.notificationsService.findExistingByReference(
          NotificationType.MAINTENANCE_DUE,
          String(device._id),
          today,
        );

        if (existingNotif) continue;

        await this.notificationsService.create({
          message: isToday
            ? `Maintenance due today for device "${device.name}"`
            : `Maintenance due tomorrow for device "${device.name}"`,
          type: NotificationType.MAINTENANCE_DUE,
        userEmail: device.email || 'N/A',
          userName: device.owner || 'Unknown',
          recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
          referenceId: String(device._id),
          referenceModel: 'Device',
        });
      }
    } catch (e) {
      console.error('Failed to check maintenance due dates:', e);
    }
  }

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const status =
      normalizeDeviceStatus(createDeviceDto.status || 'available') ||
      'available';
    const payload: any = {
      ...createDeviceDto,
      status,
      department: createDeviceDto.department || 'Non spécifié',
      owner: createDeviceDto.owner || 'À définir',
      email: createDeviceDto.email || '',
      location: createDeviceDto.location || 'À définir',
      serialNumber: createDeviceDto.serialNumber || `AUTO-${Date.now()}`,
    };

    // Auto-calculate maintenance dates if maintenance is enabled
    if (payload.maintenanceEnabled && payload.maintenanceStartDate) {
      const startDate = new Date(payload.maintenanceStartDate);
      if (payload.maintenanceFrequency) {
        const nextDate = this.addFrequencyMonths(startDate, payload.maintenanceFrequency);
        payload.maintenanceEndDate = nextDate;
        payload.nextMaintenanceDate = nextDate;
      } else if (payload.maintenanceEndDate) {
        payload.nextMaintenanceDate = new Date(payload.maintenanceEndDate);
      }
    }

    const createdDevice = new this.deviceModel(payload);
    return createdDevice.save();
  }

  private async resolveUserNames(device: any): Promise<any> {
    const obj = device.toObject ? device.toObject() : { ...device };
    if (obj.assignedTo) {
      try {
        const user = await this.usersService.findOne(obj.assignedTo);
        obj.assignedToName = user ? `${user.prenom} ${user.nom}` : obj.assignedTo;
      } catch {
        obj.assignedToName = obj.assignedTo;
      }
    }
    if (obj.assignedBy) {
      try {
        const user = await this.usersService.findOne(obj.assignedBy);
        obj.assignedByName = user ? `${user.prenom} ${user.nom}` : obj.assignedBy;
      } catch {
        obj.assignedByName = obj.assignedBy;
      }
    }
    return obj;
  }

  async findAll(
    page?: string,
    limit?: string,
    search?: string,
    status?: string,
    type?: string,
    sortOrder?: string,
  ): Promise<{
    devices: any[];
    total: number;
    page: number;
    limit: number;
  }> {
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

    if (status && status !== 'all') {
      query = query.where({ status });
    }

    if (type && type !== 'all') {
      query = query.where({ type });
    }

    const sort = sortOrder === 'asc' ? { createdAt: 1 as const } : { createdAt: -1 as const };

    const [devices, total] = await Promise.all([
      query.clone().sort(sort).skip(skip).limit(limitNum).exec(),
      query.clone().countDocuments().exec(),
    ]);

    const enriched = await Promise.all(devices.map((d) => this.resolveUserNames(d)));

    return { devices: enriched, total, page: pageNum, limit: limitNum };
  }

  async findAssigned(
    userId: string,
    role: Role,
    page?: string,
    limit?: string,
    search?: string,
    forUserId?: string,
    sortOrder?: string,
  ): Promise<{
    devices: Device[];
    total: number;
    page: number;
    limit: number;
  }> {
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

    const sort = sortOrder === 'asc' ? { createdAt: 1 as const } : { createdAt: -1 as const };

    const [devices, total] = await Promise.all([
      query.clone().sort(sort).skip(skip).limit(limitNum).exec(),
      query.clone().countDocuments().exec(),
    ]);

    const enriched = await Promise.all(devices.map((d) => this.resolveUserNames(d)));

    return { devices: enriched, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async findOneForUser(
    userId: string,
    role: Role,
    id: string,
  ): Promise<any> {
    const device = await this.findOne(id);

    if (role === Role.CONSULTANT) {
      if (!device.assignedTo || device.assignedTo.toString() !== userId) {
        throw new ForbiddenException('Access denied to this device');
      }
    }

    const deviceObj = (device as DeviceDocument).toObject();

    if (deviceObj.assignedTo) {
      try {
        const user = await this.usersService.findOne(deviceObj.assignedTo);
        deviceObj.assignedToName = user ? `${user.prenom} ${user.nom}` : deviceObj.assignedTo;
      } catch {
        deviceObj.assignedToName = deviceObj.assignedTo;
      }
    }

    if (deviceObj.assignedBy) {
      try {
        const user = await this.usersService.findOne(deviceObj.assignedBy);
        deviceObj.assignedByName = user ? `${user.prenom} ${user.nom}` : deviceObj.assignedBy;
      } catch {
        deviceObj.assignedByName = deviceObj.assignedBy;
      }
    }

    return deviceObj;
  }

  async update(
    id: string,
    updateDeviceDto: Partial<CreateDeviceDto>,
  ): Promise<Device> {
    const payload: any = { ...updateDeviceDto };

    // Auto-calculate maintenance dates if maintenance fields are being updated
    if (payload.maintenanceEnabled && payload.maintenanceStartDate) {
      const startDate = new Date(payload.maintenanceStartDate);
      if (payload.maintenanceFrequency) {
        const nextDate = this.addFrequencyMonths(startDate, payload.maintenanceFrequency);
        payload.maintenanceEndDate = nextDate;
        payload.nextMaintenanceDate = nextDate;
      } else if (payload.maintenanceEndDate) {
        payload.nextMaintenanceDate = new Date(payload.maintenanceEndDate);
      }
    } else if (payload.maintenanceEnabled === false) {
      payload.nextMaintenanceDate = null;
      payload.maintenanceEndDate = null;
      payload.lastMaintenanceDate = null;
    }

    const device = await this.deviceModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async updateStatus(
    id: string,
    updateStatusDto: { status: DeviceStatus },
  ): Promise<Device> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const transitionAllowed =
      (device.status === 'available' &&
        updateStatusDto.status === 'maintenance') ||
      (device.status === 'maintenance' &&
        updateStatusDto.status === 'available') ||
      (device.status === 'assigned' &&
        updateStatusDto.status === 'maintenance');

    if (!transitionAllowed) {
      throw new BadRequestException(
        'Only available <-> maintenance transitions are allowed from this action',
      );
    }

    const updated = await this.deviceModel
      .findByIdAndUpdate(
        id,
        {
          status: updateStatusDto.status,
          assignedTo:
            updateStatusDto.status === 'available' ? null : device.assignedTo,
          assignedAt:
            updateStatusDto.status === 'available' ? null : device.assignedAt,
          assignedBy:
            updateStatusDto.status === 'available' ? null : device.assignedBy,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    // Create notification
    try {
      await this.notificationsService.create({
        message: `Device "${device.name}" status changed to ${updateStatusDto.status}`,
        type: NotificationType.DEVICE_STATUS_CHANGED,
        userEmail: device.email || 'N/A',
        userName: device.owner || 'Unknown',
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: id,
        referenceModel: 'Device',
      });
    } catch (e) {
      console.error('Failed to create device status notification', e);
    }

    return updated;
  }

  async allocateDevice(
    deviceId: string,
    consultantId: string,
    assignedBy?: string,
  ): Promise<Device> {
    try {
      const device = await this.deviceModel.findById(deviceId).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }

      if (device.status !== 'available') {
        throw new BadRequestException(
          'Only available devices can be allocated',
        );
      }

      let consultant;
      try {
        consultant = await this.usersService.findOne(consultantId);
      } catch (err) {
        if (consultantId.includes('@')) {
          consultant = await this.usersService.findByEmail(consultantId);
        }
      }

      if (
        !consultant ||
        (consultant.role !== Role.CONSULTANT &&
          consultant.role !== Role.IT &&
          consultant.role !== Role.ADMIN)
      ) {
        throw new BadRequestException('Selected consultant is not valid');
      }

      const updated = await this.deviceModel
        .findByIdAndUpdate(
          deviceId,
          {
            status: 'assigned',
            assignedTo: consultant._id?.toString() || consultantId,
            assignedAt: new Date(),
            assignedBy: assignedBy ?? null,
          },
          { returnDocument: 'after' },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Device not found');
      }

      // Create notification
      try {
        let assignedByName = 'System';
        if (assignedBy) {
          const assignedByUser = await this.usersService.findOne(assignedBy);
          assignedByName = assignedByUser ? `${assignedByUser.nom} ${assignedByUser.prenom}` : 'Unknown';
        }
        const consultantName = consultant ? `${consultant.nom} ${consultant.prenom}` : 'Unknown';
        await this.notificationsService.create({
          message: `Device "${device.name}" has been allocated to ${consultantName} by ${assignedByName}`,
          type: NotificationType.DEVICE_ALLOCATED,
          userEmail: consultant?.email || 'N/A',
          userName: consultantName,
          recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
          referenceId: deviceId,
          referenceModel: 'Device',
        });
      } catch (e) {
        console.error('Failed to create device allocation notification', e);
      }

      return updated;
    } catch (error) {
      console.error('ALLOCATE_DEVICE_ERROR', {
        deviceId,
        consultantId,
        assignedBy,
        error,
      });
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

    const updated = await this.deviceModel
      .findByIdAndUpdate(
        deviceId,
        {
          status: 'available',
          assignedTo: null,
          assignedAt: null,
          assignedBy: null,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    // Create notification
    try {
      await this.notificationsService.create({
        message: `Device "${device.name}" has been returned and is now available`,
        type: NotificationType.DEVICE_RETURNED,
        userEmail: device.email || 'N/A',
        userName: device.owner || 'Unknown',
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: deviceId,
        referenceModel: 'Device',
      });
    } catch (e) {
      console.error('Failed to create device return notification', e);
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
    const updated = await this.deviceModel
      .findByIdAndUpdate(
        deviceId,
        { $set: { photos: [photoUrl] } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Device not found');
    }
    return updated;
  }

  async importDevices(
    file: any,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
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
        errors.push(
          `Row ${rowNumber}: Missing required fields (name, type, serialNumber)`,
        );
        failedCount++;
        return;
      }

      if (!status) {
        errors.push(
          `Row ${rowNumber}: Status "${rawStatus || 'empty'}" is not recognized. Valid values: Disponible/Available, Assigné/Assigned, Maintenance, Retiré/Retired`,
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
        errors.push(
          `Failed to create device "${device.name}": ${error.message}`,
        );
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
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' },
    };
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
      });

      // Zebra striping
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
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

  async findAllWithMaintenance(month?: number, year?: number): Promise<any[]> {
    let query = this.deviceModel.find({ maintenanceEnabled: true });

    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      query = query.where({ nextMaintenanceDate: { $gte: startDate, $lte: endDate } });
    } else if (year !== undefined) {
      const startDate = new Date(year, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, 11, 31);
      endDate.setHours(23, 59, 59, 999);
      query = query.where({ nextMaintenanceDate: { $gte: startDate, $lte: endDate } });
    }

    return query.sort({ nextMaintenanceDate: 1 }).exec();
  }

  async getDevicesWithoutMaintenance(): Promise<any[]> {
    return this.deviceModel.find({ maintenanceEnabled: { $ne: true } }).exec();
  }

  async updateMaintenance(
    id: string,
    updateDto: { maintenanceDescription?: string; maintenanceEndDate?: string; maintenanceFrequency?: string },
  ): Promise<any> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const payload: any = {};
    if (updateDto.maintenanceDescription !== undefined) payload.maintenanceDescription = updateDto.maintenanceDescription;

    if (updateDto.maintenanceFrequency) {
      // Deadline follows the frequency: recalculate from the current base date
      payload.maintenanceFrequency = updateDto.maintenanceFrequency;
      const baseDate =
        (device.maintenanceStartDate as Date) ||
        (device.nextMaintenanceDate as Date) ||
        (device.maintenanceEndDate as Date) ||
        new Date();
      const nextDate = this.addFrequencyMonths(baseDate, updateDto.maintenanceFrequency as MaintenanceFrequency);
      payload.maintenanceEndDate = nextDate;
      payload.nextMaintenanceDate = nextDate;
    } else if (updateDto.maintenanceEndDate) {
      const endDate = new Date(updateDto.maintenanceEndDate);
      payload.maintenanceEndDate = endDate;
      payload.nextMaintenanceDate = endDate;
    }

    return this.deviceModel.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).exec();
  }

  async markDeviceAsMaintained(id: string): Promise<Device> {
    const device = await this.deviceModel.findById(id).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (!device.maintenanceEnabled) {
      throw new BadRequestException('Device does not have maintenance enabled');
    }

    const now = new Date();
    let nextEndDate: Date;

    if (device.maintenanceFrequency && device.maintenanceStartDate) {
      const freqMonths = this.getFrequencyMonths(device.maintenanceFrequency);
      nextEndDate = new Date(now);
      nextEndDate.setMonth(nextEndDate.getMonth() + freqMonths);
    } else if (device.maintenanceStartDate && device.maintenanceEndDate) {
      const duration = device.maintenanceEndDate.getTime() - device.maintenanceStartDate.getTime();
      nextEndDate = new Date(now.getTime() + duration);
    } else {
      throw new BadRequestException('Insufficient maintenance data to calculate next date');
    }

    const updated = await this.deviceModel
      .findByIdAndUpdate(
        id,
        {
          lastMaintenanceDate: now,
          maintenanceStartDate: now,
          maintenanceEndDate: nextEndDate,
          nextMaintenanceDate: nextEndDate,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    return updated;
  }

  private addFrequencyMonths(date: Date, frequency: MaintenanceFrequency): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + this.getFrequencyMonths(frequency));
    return next;
  }

  private getFrequencyMonths(frequency: MaintenanceFrequency): number {
    switch (frequency) {
      case '1month': return 1;
      case '3months': return 3;
      case '6months': return 6;
      case '9months': return 9;
      case '1year': return 12;
      default: return 1;
    }
  }
}
