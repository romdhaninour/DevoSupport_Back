/// <reference types="jest" />
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Role } from '../users/user.schema';

describe('DevicesController', () => {
  let controller: DevicesController;
  let service: Partial<DevicesService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAssigned: jest.fn(),
      findOne: jest.fn(),
      findOneForUser: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      allocateDevice: jest.fn(),
      returnDevice: jest.fn(),
      remove: jest.fn(),
      importDevices: jest.fn(),
      addPhoto: jest.fn(),
      exportDevices: jest.fn(),
      findAllWithMaintenance: jest.fn(),
      getDevicesWithoutMaintenance: jest.fn(),
      updateMaintenance: jest.fn(),
      markDeviceAsMaintained: jest.fn(),
    };
    controller = new DevicesController(service as DevicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const dto = {
    name: 'Laptop',
    type: 'Laptop',
    department: 'IT',
    owner: 'Alice',
    email: 'alice@company.com',
    status: 'available',
    location: 'Office 1',
    serialNumber: 'SN-001',
    purchaseDate: '2026-01-01',
  };

  const adminReq = { user: { role: Role.ADMIN, userId: 'admin-1', sub: 'admin-1' } };
  const itReq = { user: { role: Role.IT, userId: 'it-1', sub: 'it-1' } };
  const consultantReq = { user: { role: Role.CONSULTANT, userId: 'cons-1', sub: 'cons-1' } };

  describe('create', () => {
    it('allows admins to create a device', async () => {
      const createdDevice = { ...dto, id: 'device-1' };
      (service.create as jest.Mock).mockResolvedValue(createdDevice);

      await expect(
        controller.create(adminReq as any, dto as any, null),
      ).resolves.toEqual(createdDevice);
    });

    it('allows IT staff to create a device', async () => {
      const createdDevice = { ...dto, id: 'device-1' };
      (service.create as jest.Mock).mockResolvedValue(createdDevice);

      await expect(
        controller.create(itReq as any, dto as any, null),
      ).resolves.toEqual(createdDevice);
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.create(consultantReq as any, dto as any, null),
      ).rejects.toThrow(ForbiddenException);
    });

    it('includes photo URL when file is uploaded', async () => {
      const createdDevice = { ...dto, photos: ['http://localhost:3000/uploads/devices/photo.jpg'] };
      (service.create as jest.Mock).mockResolvedValue(createdDevice);

      const file = { filename: 'photo.jpg' };
      const req = {
        user: { role: Role.ADMIN },
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      };

      const result = await controller.create(req as any, dto as any, file as any);
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: ['http://localhost:3000/uploads/devices/photo.jpg'],
        }),
      );
    });

    it('rethrows errors from service.create', async () => {
      (service.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create(adminReq as any, dto as any, null),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findAll', () => {
    it('allows IT to view all devices', async () => {
      const mockResult = { devices: [], total: 0, page: 1, limit: 10 };
      (service.findAll as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.findAll(
        itReq as any,
        '1', '10', 'search', 'available', 'Laptop',
      );

      expect(service.findAll).toHaveBeenCalledWith('1', '10', 'search', 'available', 'Laptop', undefined);
      expect(result).toEqual(mockResult);
    });

    it('allows ADMIN to view all devices', async () => {
      const mockResult = { devices: [], total: 0, page: 1, limit: 10 };
      (service.findAll as jest.Mock).mockResolvedValue(mockResult);

      await controller.findAll(adminReq as any, '1', '10');
      expect(service.findAll).toHaveBeenCalled();
    });

    it('throws ForbiddenException for consultants', () => {
      expect(() =>
        controller.findAll(consultantReq as any),
      ).toThrow(ForbiddenException);
    });
  });

  describe('findAssigned', () => {
    it('delegates to service with userId and role', async () => {
      const mockResult = { devices: [], total: 0, page: 1, limit: 10 };
      (service.findAssigned as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.findAssigned(
        itReq as any,
        '1', '10', 'search', 'user-123',
      );

      expect(service.findAssigned).toHaveBeenCalledWith(
        'it-1', Role.IT, '1', '10', 'search', 'user-123', undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('uses userId from sub when userId is absent', async () => {
      const mockResult = { devices: [], total: 0 };
      (service.findAssigned as jest.Mock).mockResolvedValue(mockResult);

      const req = { user: { role: Role.CONSULTANT, sub: 'cons-sub-1' } };
      await controller.findAssigned(req as any);

      expect(service.findAssigned).toHaveBeenCalledWith(
        'cons-sub-1', Role.CONSULTANT, undefined, undefined, undefined, undefined, undefined,
      );
    });
  });

  describe('findOne', () => {
    it('delegates to findOneForUser with user context', async () => {
      const mockDevice = { _id: 'device-1', name: 'Laptop' };
      (service.findOneForUser as jest.Mock).mockResolvedValue(mockDevice);

      const result = await controller.findOne(adminReq as any, 'device-1');

      expect(service.findOneForUser).toHaveBeenCalledWith('admin-1', Role.ADMIN, 'device-1');
      expect(result).toEqual(mockDevice);
    });
  });

  describe('update', () => {
    it('allows IT to update a device', async () => {
      const updated = { ...dto, name: 'Updated' };
      (service.update as jest.Mock).mockResolvedValue(updated);

      const result = await controller.update(itReq as any, 'device-1', dto as any, null);

      expect(service.update).toHaveBeenCalledWith('device-1', dto);
      expect(result).toEqual(updated);
    });

    it('allows ADMIN to update a device', async () => {
      const updated = { ...dto };
      (service.update as jest.Mock).mockResolvedValue(updated);

      await controller.update(adminReq as any, 'device-1', dto as any, null);
      expect(service.update).toHaveBeenCalled();
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.update(consultantReq as any, 'device-1', dto as any, null),
      ).rejects.toThrow(ForbiddenException);
    });

    it('adds photo and returns updated device when file is provided', async () => {
      const updated = { ...dto, photos: ['http://localhost:3000/uploads/devices/photo.jpg'] };
      const file = { filename: 'photo.jpg' };
      (service.update as jest.Mock).mockResolvedValue(updated);

      const req = {
        user: { role: Role.IT },
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      };

      const result = await controller.update(req as any, 'device-1', dto as any, file as any);

      expect(service.update).toHaveBeenCalledWith('device-1', dto);
    });
  });

  describe('updateStatus', () => {
    it('allows IT to update device status', async () => {
      (service.updateStatus as jest.Mock).mockResolvedValue({ status: 'maintenance' });

      const result = await controller.updateStatus(itReq as any, 'device-1', { status: 'maintenance' });

      expect(service.updateStatus).toHaveBeenCalledWith('device-1', { status: 'maintenance' });
    });

    it('throws ForbiddenException for consultants', () => {
      expect(() =>
        controller.updateStatus(consultantReq as any, 'device-1', { status: 'maintenance' }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('allocateDevice', () => {
    it('allows IT to allocate a device', async () => {
      (service.allocateDevice as jest.Mock).mockResolvedValue({ status: 'assigned' });

      const result = await controller.allocateDevice(
        itReq as any,
        'device-1',
        { consultantId: 'cons-1' },
      );

      expect(service.allocateDevice).toHaveBeenCalledWith('device-1', 'cons-1', 'it-1');
    });

    it('throws ForbiddenException for consultants', () => {
      expect(() =>
        controller.allocateDevice(consultantReq as any, 'device-1', { consultantId: 'cons-1' }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('returnDevice', () => {
    it('allows IT to return a device', async () => {
      (service.returnDevice as jest.Mock).mockResolvedValue({ status: 'available' });

      const result = await controller.returnDevice(itReq as any, 'device-1');

      expect(service.returnDevice).toHaveBeenCalledWith('device-1');
    });

    it('throws ForbiddenException for consultants', () => {
      expect(() =>
        controller.returnDevice(consultantReq as any, 'device-1'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('allows IT to delete a device', async () => {
      (service.remove as jest.Mock).mockResolvedValue({ message: 'Deleted' });

      const result = await controller.remove(itReq as any, 'device-1');

      expect(service.remove).toHaveBeenCalledWith('device-1');
    });

    it('throws ForbiddenException for consultants', () => {
      expect(() =>
        controller.remove(consultantReq as any, 'device-1'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('importDevices', () => {
    it('allows IT to import devices', async () => {
      const file = { buffer: Buffer.from('data') };
      const importResult = { success: 5, failed: 0, errors: [] };
      (service.importDevices as jest.Mock).mockResolvedValue(importResult);

      const result = await controller.importDevices(itReq as any, file);

      expect(service.importDevices).toHaveBeenCalledWith(file);
      expect(result).toEqual(importResult);
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.importDevices(consultantReq as any, { buffer: Buffer.from('') }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no file is uploaded', async () => {
      await expect(
        controller.importDevices(itReq as any, null),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadPhoto', () => {
    it('allows IT to upload a photo', async () => {
      const file = { filename: 'photo.jpg' };
      (service.addPhoto as jest.Mock).mockResolvedValue({ photos: ['url'] });

      const req = {
        user: { role: Role.IT },
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      };

      await controller.uploadPhoto(req as any, 'device-1', file as any);

      expect(service.addPhoto).toHaveBeenCalledWith(
        'device-1',
        'http://localhost:3000/uploads/devices/photo.jpg',
      );
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.uploadPhoto(consultantReq as any, 'device-1', { filename: 'photo.jpg' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no file is uploaded', async () => {
      await expect(
        controller.uploadPhoto(itReq as any, 'device-1', null),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportDevices', () => {
    it('allows IT to export devices', async () => {
      const buffer = Buffer.from('excel data');
      (service.exportDevices as jest.Mock).mockResolvedValue(buffer);

      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      const req = { user: { role: Role.IT } };
      await controller.exportDevices(req as any, { search: 'laptop' }, res as any);

      expect(service.exportDevices).toHaveBeenCalledWith('laptop');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=appareils.xlsx',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', buffer.length);
      expect(res.send).toHaveBeenCalledWith(buffer);
    });

    it('throws ForbiddenException for consultants', async () => {
      const res = { setHeader: jest.fn(), send: jest.fn() };
      await expect(
        controller.exportDevices(consultantReq as any, {}, res as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDevicesWithMaintenance', () => {
    it('should return devices with maintenance data with month and year params', async () => {
      const mockData = [{ _id: 'd1', maintenance: [] }];
      (service.findAllWithMaintenance as jest.Mock).mockResolvedValue(mockData);

      const result = await controller.getDevicesWithMaintenance('3', '2026');

      expect(service.findAllWithMaintenance).toHaveBeenCalledWith(3, 2026);
      expect(result).toEqual(mockData);
    });

    it('should return devices with maintenance data without params', async () => {
      const mockData = [{ _id: 'd1', maintenance: [] }];
      (service.findAllWithMaintenance as jest.Mock).mockResolvedValue(mockData);

      const result = await controller.getDevicesWithMaintenance();

      expect(service.findAllWithMaintenance).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockData);
    });
  });

  describe('getDevicesWithoutMaintenance', () => {
    it('should return devices without maintenance', async () => {
      const mockData = [{ _id: 'd1' }];
      (service.getDevicesWithoutMaintenance as jest.Mock).mockResolvedValue(mockData);

      const result = await controller.getDevicesWithoutMaintenance();

      expect(service.getDevicesWithoutMaintenance).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  describe('updateDeviceMaintenance', () => {
    it('allows IT to update device maintenance', async () => {
      const body = { maintenanceDescription: 'Annual check', maintenanceEndDate: '2026-12-31', maintenanceFrequency: 'yearly' };
      const updated = { ...dto, maintenance: body };
      (service.updateMaintenance as jest.Mock).mockResolvedValue(updated);

      const result = await controller.updateDeviceMaintenance(itReq as any, 'device-1', body);

      expect(service.updateMaintenance).toHaveBeenCalledWith('device-1', body);
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.updateDeviceMaintenance(consultantReq as any, 'device-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markDeviceAsMaintained', () => {
    it('allows IT to mark device as maintained', async () => {
      const updated = { ...dto, lastMaintained: new Date() };
      (service.markDeviceAsMaintained as jest.Mock).mockResolvedValue(updated);

      const result = await controller.markDeviceAsMaintained(itReq as any, 'device-1');

      expect(service.markDeviceAsMaintained).toHaveBeenCalledWith('device-1');
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException for consultants', async () => {
      await expect(
        controller.markDeviceAsMaintained(consultantReq as any, 'device-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
