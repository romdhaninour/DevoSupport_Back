/// <reference types="jest" />
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DevicesService, normalizeDeviceStatus, formatDeviceStatusForExport } from './devices.service';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import * as ExcelJS from 'exceljs';

jest.mock('exceljs', () => ({
  Workbook: jest.fn(),
}));

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceModel: any;
  let usersService: Partial<UsersService>;
  let notificationsService: Partial<NotificationsService>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    deviceModel = jest.fn() as any;
    deviceModel.findById = jest.fn();
    deviceModel.findByIdAndUpdate = jest.fn();
    deviceModel.findByIdAndDelete = jest.fn();
    deviceModel.findOne = jest.fn();
    deviceModel.find = jest.fn();
    deviceModel.create = jest.fn();
    deviceModel.countDocuments = jest.fn();
    deviceModel.deleteOne = jest.fn();
    usersService = {
      findOne: jest.fn(),
      findByEmail: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
    };
    service = new DevicesService(deviceModel, usersService as UsersService, notificationsService as NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('normalizeDeviceStatus()', () => {
    it('returns exact matching enum values unchanged', () => {
      expect(normalizeDeviceStatus('available')).toBe('available');
      expect(normalizeDeviceStatus('assigned')).toBe('assigned');
      expect(normalizeDeviceStatus('maintenance')).toBe('maintenance');
      expect(normalizeDeviceStatus('retired')).toBe('retired');
    });

    it('accepts French labels and normalizes them to enum values', () => {
      expect(normalizeDeviceStatus('Disponible')).toBe('available');
      expect(normalizeDeviceStatus('Assigné')).toBe('assigned');
      expect(normalizeDeviceStatus('En maintenance')).toBe('maintenance');
      expect(normalizeDeviceStatus('Retiré')).toBe('retired');
    });

    it('handles case and whitespace variations', () => {
      expect(normalizeDeviceStatus('  disponible  ')).toBe('available');
      expect(normalizeDeviceStatus('MAINTENANCE')).toBe('maintenance');
      expect(normalizeDeviceStatus('  AssignÉ ')).toBe('assigned');
    });

    it('returns null for unknown status values', () => {
      expect(normalizeDeviceStatus('Unknown')).toBeNull();
      expect(normalizeDeviceStatus('')).toBe('available');
    });

    it('handles "dispo" shorthand', () => {
      expect(normalizeDeviceStatus('dispo')).toBe('available');
    });

    it('handles "attribue" for assigned', () => {
      expect(normalizeDeviceStatus('attribue')).toBe('assigned');
    });

    it('handles "retire" without accent', () => {
      expect(normalizeDeviceStatus('retire')).toBe('retired');
    });

    it('handles "retraite" for retired', () => {
      expect(normalizeDeviceStatus('retraite')).toBe('retired');
    });

    it('handles includes("assign") pattern', () => {
      expect(normalizeDeviceStatus('assigne')).toBe('assigned');
    });

    it('handles includes("retir") pattern', () => {
      expect(normalizeDeviceStatus('retire')).toBe('retired');
    });
  });

  describe('formatDeviceStatusForExport()', () => {
    it('formats assigned status', () => {
      expect(formatDeviceStatusForExport('assigned')).toBe('Assigné');
    });

    it('formats maintenance status', () => {
      expect(formatDeviceStatusForExport('maintenance')).toBe('Maintenance');
    });

    it('formats retired status', () => {
      expect(formatDeviceStatusForExport('retired')).toBe('Retiré');
    });

    it('formats available status as default', () => {
      expect(formatDeviceStatusForExport('available')).toBe('Disponible');
    });
  });

  describe('create', () => {
    it('creates a device with provided status', async () => {
      const dto = {
        name: 'Laptop',
        type: 'Laptop' as any,
        department: 'IT',
        owner: 'Alice',
        serialNumber: 'SN-001',
        location: 'Office',
        status: 'available' as any,
      };

      const mockSave = jest.fn().mockResolvedValue({ ...dto, _id: 'device-1' });
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.create(dto);

      expect(result).toBeDefined();
    });

    it('creates a device with default values for missing fields', async () => {
      const dto = {
        name: 'Laptop',
        type: 'Laptop' as any,
        department: '',
        owner: '',
        serialNumber: '',
        location: '',
      };

      const mockSave = jest.fn().mockResolvedValue({ ...dto, _id: 'device-1' });
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.create(dto);

      expect(mockSave).toHaveBeenCalled();
    });

    it('calculates nextMaintenanceDate when maintenanceEnabled, maintenanceStartDate and maintenanceFrequency are set', async () => {
      const dto = {
        name: 'Laptop',
        type: 'Laptop' as any,
        department: 'IT',
        owner: 'Alice',
        serialNumber: 'SN-001',
        location: 'Office',
        maintenanceEnabled: true,
        maintenanceStartDate: '2026-01-01',
        maintenanceFrequency: '3months' as any,
      };

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.create(dto);

      expect(result.nextMaintenanceDate).toBeDefined();
      const expectedDate = new Date('2026-01-01');
      expectedDate.setMonth(expectedDate.getMonth() + 3);
      expect(result.nextMaintenanceDate.getTime()).toBe(expectedDate.getTime());
    });

    it('uses maintenanceEndDate as nextMaintenanceDate when no frequency is provided', async () => {
      const dto = {
        name: 'Laptop',
        type: 'Laptop' as any,
        department: 'IT',
        owner: 'Alice',
        serialNumber: 'SN-002',
        location: 'Office',
        maintenanceEnabled: true,
        maintenanceStartDate: '2026-01-01',
        maintenanceEndDate: '2026-06-15',
      };

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.create(dto);

      expect(result.nextMaintenanceDate).toBeDefined();
      expect(result.nextMaintenanceDate.toISOString().startsWith('2026-06-15')).toBe(true);
    });
  });

  describe('findAll', () => {
    it('returns devices with pagination and no filters', async () => {
      const mockDevices = [{ _id: '1', name: 'Laptop' }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(1),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll('1', '10');

      expect(result.devices).toEqual(mockDevices);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('applies search filter', async () => {
      const mockQuery = {
        or: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAll('1', '10', 'laptop');

      expect(mockQuery.or).toHaveBeenCalledWith([
        { name: { $regex: 'laptop', $options: 'i' } },
        { serialNumber: { $regex: 'laptop', $options: 'i' } },
        { owner: { $regex: 'laptop', $options: 'i' } },
        { department: { $regex: 'laptop', $options: 'i' } },
      ]);
    });

    it('applies status filter when not "all"', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAll('1', '10', undefined, 'available');

      expect(mockQuery.where).toHaveBeenCalledWith({ status: 'available' });
    });

    it('does not apply status filter when "all"', async () => {
      const mockQuery = {
        where: jest.fn(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAll('1', '10', undefined, 'all');

      expect(mockQuery.where).not.toHaveBeenCalled();
    });

    it('applies type filter when not "all"', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAll('1', '10', undefined, undefined, 'Laptop');

      expect(mockQuery.where).toHaveBeenCalledWith({ type: 'Laptop' });
    });

    it('does not apply type filter when "all"', async () => {
      const mockQuery = {
        where: jest.fn(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAll('1', '10', undefined, undefined, 'all');

      expect(mockQuery.where).not.toHaveBeenCalled();
    });

    it('defaults to page 1 and limit 10 when params are undefined', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('findAssigned', () => {
    it('returns assigned devices for a consultant', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
        or: jest.fn().mockReturnThis(),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      const result = await service.findAssigned('cons-1', Role.CONSULTANT, '1', '10');

      expect(deviceModel.find).toHaveBeenCalledWith({
        status: 'assigned',
        assignedTo: 'cons-1',
      });
      expect(result.devices).toEqual([]);
    });

    it('returns assigned devices for IT without forUserId', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAssigned('it-1', Role.IT, '1', '10');

      expect(deviceModel.find).toHaveBeenCalledWith({
        status: 'assigned',
        assignedTo: 'it-1',
      });
    });

    it('returns assigned devices for specific consultant when forUserId is provided by IT', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAssigned('it-1', Role.IT, '1', '10', undefined, 'cons-99');

      expect(deviceModel.find).toHaveBeenCalledWith({
        status: 'assigned',
        assignedTo: 'cons-99',
      });
    });

    it('applies search filter to assigned devices', async () => {
      const mockQuery = {
        or: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        clone: jest.fn(),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      };
      mockQuery.clone.mockReturnValue(mockQuery);
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAssigned('cons-1', Role.CONSULTANT, '1', '10', 'laptop');

      expect(mockQuery.or).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a device when found', async () => {
      const mockDevice = { _id: 'device-1', name: 'Laptop 1' };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      await expect(service.findOne('device-1')).resolves.toEqual(mockDevice);
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneForUser', () => {
    it('returns device for IT role without access check', async () => {
      const plainDevice = { _id: 'device-1', name: 'Laptop', assignedTo: 'other-user' };
      const mockDevice = { ...plainDevice, toObject: jest.fn(() => ({ ...plainDevice })) };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      const result = await service.findOneForUser('it-1', Role.IT, 'device-1');
      expect(result).toEqual({ ...plainDevice, assignedToName: 'other-user' });
    });

    it('returns device for ADMIN role without access check', async () => {
      const plainDevice = { _id: 'device-1', name: 'Laptop', assignedTo: 'other-user' };
      const mockDevice = { ...plainDevice, toObject: jest.fn(() => ({ ...plainDevice })) };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      const result = await service.findOneForUser('admin-1', Role.ADMIN, 'device-1');
      expect(result).toEqual({ ...plainDevice, assignedToName: 'other-user' });
    });

    it('returns device for consultant when assigned to them', async () => {
      const plainDevice = { _id: 'device-1', name: 'Laptop', assignedTo: 'cons-1' };
      const mockDevice = { ...plainDevice, toObject: jest.fn(() => ({ ...plainDevice })) };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      const result = await service.findOneForUser('cons-1', Role.CONSULTANT, 'device-1');
      expect(result).toEqual({ ...plainDevice, assignedToName: 'cons-1' });
    });

    it('throws ForbiddenException for consultant when device not assigned to them', async () => {
      const mockDevice = { _id: 'device-1', name: 'Laptop', assignedTo: 'other-user' };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      await expect(
        service.findOneForUser('cons-1', Role.CONSULTANT, 'device-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for consultant when device has no assignedTo', async () => {
      const mockDevice = { _id: 'device-1', name: 'Laptop', assignedTo: null };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice),
      });

      await expect(
        service.findOneForUser('cons-1', Role.CONSULTANT, 'device-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates a device successfully', async () => {
      const updated = { _id: 'device-1', name: 'Updated' };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.update('device-1', { name: 'Updated' } as any);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('nonexistent', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('recalculates nextMaintenanceDate when update has maintenanceEnabled, maintenanceStartDate and maintenanceFrequency', async () => {
      const updateDto = {
        maintenanceEnabled: true,
        maintenanceStartDate: '2026-03-01',
        maintenanceFrequency: '6months',
      };
      const updated = { _id: 'device-1', ...updateDto, nextMaintenanceDate: new Date('2026-09-01') };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      await service.update('device-1', updateDto as any);

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          nextMaintenanceDate: expect.any(Date),
        }),
        { returnDocument: 'after' },
      );
    });

    it('uses maintenanceEndDate as nextMaintenanceDate when update has no frequency', async () => {
      const updateDto = {
        maintenanceEnabled: true,
        maintenanceStartDate: '2026-01-01',
        maintenanceEndDate: '2026-12-31',
      };
      const updated = { _id: 'device-1', ...updateDto, nextMaintenanceDate: new Date('2026-12-31') };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      await service.update('device-1', updateDto as any);

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          nextMaintenanceDate: new Date('2026-12-31'),
        }),
        { returnDocument: 'after' },
      );
    });

    it('clears maintenance fields when maintenanceEnabled is set to false', async () => {
      const updateDto = { maintenanceEnabled: false };
      const updated = {
        _id: 'device-1',
        maintenanceEnabled: false,
        nextMaintenanceDate: null,
        maintenanceEndDate: null,
        lastMaintenanceDate: null,
      };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      await service.update('device-1', updateDto as any);

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          maintenanceEnabled: false,
          nextMaintenanceDate: null,
          maintenanceEndDate: null,
          lastMaintenanceDate: null,
        }),
        { returnDocument: 'after' },
      );
    });
  });

  describe('updateStatus', () => {
    it('updates status to maintenance via the dedicated status endpoint', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'maintenance' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'maintenance' } as any),
      ).resolves.toMatchObject({ status: 'maintenance' });
    });

    it('allows maintenance -> available transition', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'maintenance' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'available' } as any),
      ).resolves.toMatchObject({ status: 'available' });
    });

    it('allows assigned -> maintenance transition', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'c1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'maintenance' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'maintenance' } as any),
      ).resolves.toMatchObject({ status: 'maintenance' });
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateStatus('nonexistent', { status: 'maintenance' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid transition (available -> assigned)', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'assigned' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid transition (maintenance -> assigned)', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'maintenance' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'assigned' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when findByIdAndUpdate returns null after update', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateStatus('device-1', { status: 'maintenance' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears assignedTo when transitioning to available', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          status: 'maintenance',
          assignedTo: 'cons-1',
          assignedAt: new Date(),
          assignedBy: 'it-1',
        }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', assignedTo: null }),
      });

      await service.updateStatus('device-1', { status: 'available' } as any);

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          status: 'available',
          assignedTo: null,
          assignedAt: null,
          assignedBy: null,
        }),
        { returnDocument: 'after' },
      );
    });
  });

  describe('allocateDevice', () => {
    it('rejects allocation when the device is not available', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned' }),
      });

      await expect(
        service.allocateDevice('device-1', 'consultant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when device does not exist', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.allocateDevice('nonexistent', 'consultant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user does not exist', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.allocateDevice('device-1', 'nonexistent-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user role is not valid for allocation', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'user-1',
        role: 'INVALID',
      });

      await expect(
        service.allocateDevice('device-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows allocation to an admin user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'admin-1',
        role: Role.ADMIN,
        nom: 'Doe',
        prenom: 'John',
        email: 'admin@test.com',
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'admin-1' }),
      });

      const result = await service.allocateDevice('device-1', 'admin-1', 'assigner-1');
      expect(result).toMatchObject({ status: 'assigned' });
    });

    it('allows allocation to a consultant user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'consultant-1',
        role: Role.CONSULTANT,
        nom: 'Smith',
        prenom: 'Jane',
        email: 'cons@test.com',
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'consultant-1' }),
      });

      const result = await service.allocateDevice('device-1', 'consultant-1', 'assigner-1');
      expect(result).toMatchObject({ status: 'assigned' });
    });

    it('allows allocation to an IT user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'it-1',
        role: Role.IT,
        nom: 'Tech',
        prenom: 'Guy',
        email: 'it@test.com',
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'it-1' }),
      });

      const result = await service.allocateDevice('device-1', 'it-1', 'assigner-1');
      expect(result).toMatchObject({ status: 'assigned' });
    });

    it('throws NotFoundException when updated device returns null', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'admin-1',
        role: Role.ADMIN,
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.allocateDevice('device-1', 'admin-1', 'assigner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('falls back to findByEmail when findOne fails and consultantId contains @', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock).mockRejectedValue(new Error('Not found'));
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        _id: 'cons-email-1',
        role: Role.CONSULTANT,
        nom: 'Email',
        prenom: 'User',
        email: 'cons@test.com',
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'cons-email-1' }),
      });

      const result = await service.allocateDevice('device-1', 'cons@test.com', 'assigner-1');
      expect(result).toMatchObject({ status: 'assigned' });
      expect(usersService.findByEmail).toHaveBeenCalledWith('cons@test.com');
    });

    it('throws BadRequestException when findByEmail also fails for email-like ID', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockRejectedValue(new Error('Not found'));
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.allocateDevice('device-1', 'nonexistent@email.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates notification on successful allocation', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: 'admin-1', role: Role.ADMIN, nom: 'Admin', prenom: 'User', email: 'admin@test.com' })
        .mockResolvedValueOnce({ _id: 'assigner-1', nom: 'Assigner', prenom: 'Person' });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned' }),
      });

      await service.allocateDevice('device-1', 'admin-1', 'assigner-1');

      expect(notificationsService.create).toHaveBeenCalled();
    });

    it('does not throw when notification creation fails', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', name: 'Laptop' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'admin-1',
        role: Role.ADMIN,
        nom: 'Admin',
        prenom: 'User',
        email: 'admin@test.com',
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned' }),
      });
      (notificationsService.create as jest.Mock).mockRejectedValue(new Error('Notification error'));

      await expect(
        service.allocateDevice('device-1', 'admin-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('returnDevice', () => {
    it('allows returning an assigned device', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1', status: 'assigned', assignedTo: 'consultant-1', name: 'Laptop', email: '', owner: 'User',
        }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available', assignedTo: null }),
      });

      const result = await service.returnDevice('device-1');
      expect(result).toMatchObject({ status: 'available', assignedTo: null });
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.returnDevice('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when device is not assigned', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });

      await expect(service.returnDevice('device-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when findByIdAndUpdate returns null', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.returnDevice('device-1')).rejects.toThrow(NotFoundException);
    });

    it('creates notification on successful return', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1', status: 'assigned', name: 'Laptop', email: '', owner: 'User',
        }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });

      await service.returnDevice('device-1');

      expect(notificationsService.create).toHaveBeenCalled();
    });

    it('does not throw when notification creation fails', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1', status: 'assigned', name: 'Laptop', email: '', owner: 'User',
        }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (notificationsService.create as jest.Mock).mockRejectedValue(new Error('Notification error'));

      await expect(service.returnDevice('device-1')).resolves.toBeDefined();
    });
  });

  describe('remove', () => {
    it('deletes a device successfully', async () => {
      deviceModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });

      const result = await service.remove('device-1');
      expect(result).toEqual({ message: 'Device deleted successfully' });
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPhoto', () => {
    it('updates device photos', async () => {
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', photos: ['url'] }),
      });

      const result = await service.addPhoto('device-1', 'url');
      expect(result).toMatchObject({ photos: ['url'] });
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.addPhoto('nonexistent', 'url')).rejects.toThrow(NotFoundException);
    });
  });

  describe('importDevices', () => {
    it('throws BadRequestException when no worksheet found', async () => {
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        xlsx: { load: jest.fn().mockResolvedValue(undefined) },
        worksheets: [],
      }));

      const file = { buffer: Buffer.from('') };

      await expect(service.importDevices(file)).rejects.toThrow(BadRequestException);
    });

    it('parses rows and creates devices successfully', async () => {
      const mockWorksheet = {
        eachRow: jest.fn().mockImplementation((callback: any) => {
          callback({ getCell: () => ({ value: undefined }) }, 1);
          callback({
            getCell: (i: number) => {
              const values = ['Laptop', 'Laptop', 'SN-001', 'available', 'IT', 'Alice', 'Office'];
              return { value: values[i - 1] };
            },
          }, 2);
        }),
      };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        xlsx: { load: jest.fn().mockResolvedValue(undefined) },
        worksheets: [mockWorksheet],
      }));

      const mockSave = jest.fn().mockResolvedValue({ _id: 'device-1' });
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.importDevices({ buffer: Buffer.from('') });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('reports errors for missing required fields', async () => {
      const mockWorksheet = {
        eachRow: jest.fn().mockImplementation((callback: any) => {
          callback({ getCell: () => ({ value: undefined }) }, 1);
          callback({
            getCell: (i: number) => ({ value: i === 2 ? 'Laptop' : '' }),
          }, 2);
        }),
      };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        xlsx: { load: jest.fn().mockResolvedValue(undefined) },
        worksheets: [mockWorksheet],
      }));

      const result = await service.importDevices({ buffer: Buffer.from('') });

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('Missing required fields');
    });

    it('reports errors for invalid status', async () => {
      const mockWorksheet = {
        eachRow: jest.fn().mockImplementation((callback: any) => {
          callback({ getCell: () => ({ value: undefined }) }, 1);
          callback({
            getCell: (i: number) => {
              const values = ['Laptop', 'Laptop', 'SN-001', 'InvalidStatus', 'IT', 'Alice', 'Office'];
              return { value: values[i - 1] };
            },
          }, 2);
        }),
      };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        xlsx: { load: jest.fn().mockResolvedValue(undefined) },
        worksheets: [mockWorksheet],
      }));

      const result = await service.importDevices({ buffer: Buffer.from('') });

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('not recognized');
    });

    it('reports errors when device creation fails', async () => {
      const mockWorksheet = {
        eachRow: jest.fn().mockImplementation((callback: any) => {
          callback({ getCell: () => ({ value: undefined }) }, 1);
          callback({
            getCell: (i: number) => {
              const values = ['Laptop', 'Laptop', 'SN-001', 'available', 'IT', 'Alice', 'Office'];
              return { value: values[i - 1] };
            },
          }, 2);
        }),
      };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        xlsx: { load: jest.fn().mockResolvedValue(undefined) },
        worksheets: [mockWorksheet],
      }));

      const mockSave = jest.fn().mockRejectedValue(new Error('Database error'));
      deviceModel.mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      const result = await service.importDevices({ buffer: Buffer.from('') });

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('Failed to create device');
    });
  });

  describe('exportDevices', () => {
    beforeEach(() => {
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        addWorksheet: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        addRow: jest.fn().mockReturnThis(),
        getCell: jest.fn().mockReturnThis(),
        columns: {},
        xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test-buffer')) },
      }));
    });

    it('returns a buffer with exported devices', async () => {
      const mockDevices = [
        {
          name: 'Laptop',
          type: 'Laptop',
          serialNumber: 'SN-001',
          status: 'available',
          department: 'IT',
          owner: 'Alice',
          location: 'Office',
          purchaseDate: '2026-01-01',
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
        or: jest.fn().mockReturnThis(),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const result = await service.exportDevices();

      expect(result).toBeInstanceOf(Buffer);
    });

    it('applies search filter when provided', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        or: jest.fn().mockReturnThis(),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      await service.exportDevices('laptop');

      expect(mockQuery.or).toHaveBeenCalledWith([
        { name: { $regex: 'laptop', $options: 'i' } },
        { serialNumber: { $regex: 'laptop', $options: 'i' } },
      ]);
    });

    it('applies green font for available status', async () => {
      const mockDevices = [{
        name: 'Laptop', type: 'Laptop', serialNumber: 'SN-001',
        status: 'available', department: 'IT', owner: 'Alice',
        location: 'Office', purchaseDate: '2026-01-01',
      }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const statusCell: any = {};
      const mockRow = { getCell: jest.fn().mockReturnValue(statusCell) };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        addWorksheet: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        addRow: jest.fn().mockReturnValue(mockRow),
        columns: {},
        xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('')) },
      }));

      await service.exportDevices();

      expect(statusCell.font).toEqual({ color: { argb: 'FF00B050' } });
    });

    it('applies blue font for assigned status', async () => {
      const mockDevices = [{
        name: 'Laptop', type: 'Laptop', serialNumber: 'SN-001',
        status: 'assigned', department: 'IT', owner: 'Alice',
        location: 'Office', purchaseDate: '2026-01-01',
      }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const statusCell: any = {};
      const mockRow = { getCell: jest.fn().mockReturnValue(statusCell) };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        addWorksheet: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        addRow: jest.fn().mockReturnValue(mockRow),
        columns: {},
        xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('')) },
      }));

      await service.exportDevices();

      expect(statusCell.font).toEqual({ color: { argb: 'FF0070C0' } });
    });

    it('applies yellow font for maintenance status', async () => {
      const mockDevices = [{
        name: 'Laptop', type: 'Laptop', serialNumber: 'SN-001',
        status: 'maintenance', department: 'IT', owner: 'Alice',
        location: 'Office', purchaseDate: '2026-01-01',
      }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const statusCell: any = {};
      const mockRow = { getCell: jest.fn().mockReturnValue(statusCell) };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        addWorksheet: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        addRow: jest.fn().mockReturnValue(mockRow),
        columns: {},
        xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('')) },
      }));

      await service.exportDevices();

      expect(statusCell.font).toEqual({ color: { argb: 'FFFFC000' } });
    });

    it('applies red font for retired status', async () => {
      const mockDevices = [{
        name: 'Laptop', type: 'Laptop', serialNumber: 'SN-001',
        status: 'retired', department: 'IT', owner: 'Alice',
        location: 'Office', purchaseDate: '2026-01-01',
      }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const statusCell: any = {};
      const mockRow = { getCell: jest.fn().mockReturnValue(statusCell) };
      (ExcelJS.Workbook as jest.Mock).mockImplementation(() => ({
        addWorksheet: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        addRow: jest.fn().mockReturnValue(mockRow),
        columns: {},
        xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('')) },
      }));

      await service.exportDevices();

      expect(statusCell.font).toEqual({ color: { argb: 'FFC00000' } });
    });
  });

  describe('findAllWithMaintenance', () => {
    it('returns devices with maintenanceEnabled: true sorted by nextMaintenanceDate', async () => {
      const mockDevices = [{ _id: '1', maintenanceEnabled: true, nextMaintenanceDate: new Date('2026-06-01') }];
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      const result = await service.findAllWithMaintenance();

      expect(deviceModel.find).toHaveBeenCalledWith({ maintenanceEnabled: true });
      expect(mockQuery.sort).toHaveBeenCalledWith({ nextMaintenanceDate: 1 });
      expect(result).toEqual(mockDevices);
    });

    it('filters by month and year when both are provided', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAllWithMaintenance(6, 2026);

      expect(mockQuery.where).toHaveBeenCalledWith({
        nextMaintenanceDate: {
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        },
      });
    });

    it('filters by year only when only year is provided', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAllWithMaintenance(undefined, 2026);

      expect(mockQuery.where).toHaveBeenCalledWith({
        nextMaintenanceDate: {
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        },
      });
    });

    it('does not apply date filter when neither month nor year is provided', async () => {
      const mockQuery = {
        where: jest.fn(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      deviceModel.find.mockReturnValue(mockQuery);

      await service.findAllWithMaintenance();

      expect(mockQuery.where).not.toHaveBeenCalled();
    });
  });

  describe('getDevicesWithoutMaintenance', () => {
    it('returns devices where maintenanceEnabled is not true', async () => {
      const mockDevices = [{ _id: '1', maintenanceEnabled: false }];
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevices),
      });

      const result = await service.getDevicesWithoutMaintenance();

      expect(deviceModel.find).toHaveBeenCalledWith({ maintenanceEnabled: { $ne: true } });
      expect(result).toEqual(mockDevices);
    });
  });

  describe('updateMaintenance', () => {
    it('updates maintenance fields successfully', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });
      const updated = { _id: 'device-1', maintenanceDescription: 'Fixed', maintenanceEndDate: new Date('2026-12-31'), maintenanceFrequency: '6months' };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.updateMaintenance('device-1', {
        maintenanceDescription: 'Fixed',
        maintenanceEndDate: '2026-12-31',
        maintenanceFrequency: '6months',
      });

      expect(result).toEqual(updated);
      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        {
          maintenanceDescription: 'Fixed',
          maintenanceEndDate: expect.any(Date),
          maintenanceFrequency: '6months',
        },
        { returnDocument: 'after' },
      );
    });

    it('throws NotFoundException when device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateMaintenance('nonexistent', { maintenanceDescription: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates description individually', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', maintenanceDescription: 'New desc' }),
      });

      await service.updateMaintenance('device-1', { maintenanceDescription: 'New desc' });

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        { maintenanceDescription: 'New desc' },
        { returnDocument: 'after' },
      );
    });

    it('updates endDate individually', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', maintenanceEndDate: new Date('2026-06-01') }),
      });

      await service.updateMaintenance('device-1', { maintenanceEndDate: '2026-06-01' });

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        { maintenanceEndDate: expect.any(Date) },
        { returnDocument: 'after' },
      );
    });

    it('updates frequency individually', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', maintenanceFrequency: '1year' }),
      });

      await service.updateMaintenance('device-1', { maintenanceFrequency: '1year' });

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        { maintenanceFrequency: '1year' },
        { returnDocument: 'after' },
      );
    });
  });

  describe('markDeviceAsMaintained', () => {
    it('throws NotFoundException when device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.markDeviceAsMaintained('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when maintenance is not enabled', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', maintenanceEnabled: false }),
      });

      await expect(service.markDeviceAsMaintained('device-1')).rejects.toThrow(BadRequestException);
    });

    it('uses frequency to calculate next date when maintenanceFrequency and maintenanceStartDate exist', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          maintenanceEnabled: true,
          maintenanceFrequency: '3months',
          maintenanceStartDate: new Date('2026-01-01'),
        }),
      });
      const updatedDevice = {
        _id: 'device-1',
        lastMaintenanceDate: new Date(),
        maintenanceStartDate: expect.any(Date),
        maintenanceEndDate: expect.any(Date),
        nextMaintenanceDate: expect.any(Date),
      };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDevice),
      });

      const result = await service.markDeviceAsMaintained('device-1');

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          lastMaintenanceDate: expect.any(Date),
          nextMaintenanceDate: expect.any(Date),
        }),
        { returnDocument: 'after' },
      );
      expect(result).toBeDefined();
    });

    it('uses duration to calculate next date when maintenanceStartDate and maintenanceEndDate exist', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          maintenanceEnabled: true,
          maintenanceStartDate: new Date('2026-01-01'),
          maintenanceEndDate: new Date('2026-06-01'),
        }),
      });
      const updatedDevice = {
        _id: 'device-1',
        lastMaintenanceDate: new Date(),
        maintenanceStartDate: expect.any(Date),
        maintenanceEndDate: expect.any(Date),
        nextMaintenanceDate: expect.any(Date),
      };
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDevice),
      });

      const result = await service.markDeviceAsMaintained('device-1');

      expect(deviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          lastMaintenanceDate: expect.any(Date),
          nextMaintenanceDate: expect.any(Date),
        }),
        { returnDocument: 'after' },
      );
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when insufficient maintenance data', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          maintenanceEnabled: true,
        }),
      });

      await expect(service.markDeviceAsMaintained('device-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when update returns null', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          maintenanceEnabled: true,
          maintenanceFrequency: '3months',
          maintenanceStartDate: new Date('2026-01-01'),
        }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.markDeviceAsMaintained('device-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFrequencyMonths', () => {
    it('returns 1 for 1month', () => {
      expect((service as any).getFrequencyMonths('1month')).toBe(1);
    });

    it('returns 3 for 3months', () => {
      expect((service as any).getFrequencyMonths('3months')).toBe(3);
    });

    it('returns 6 for 6months', () => {
      expect((service as any).getFrequencyMonths('6months')).toBe(6);
    });

    it('returns 9 for 9months', () => {
      expect((service as any).getFrequencyMonths('9months')).toBe(9);
    });

    it('returns 12 for 1year', () => {
      expect((service as any).getFrequencyMonths('1year')).toBe(12);
    });

    it('returns 1 as default for unknown frequency', () => {
      expect((service as any).getFrequencyMonths('unknown')).toBe(1);
    });
  });
});
