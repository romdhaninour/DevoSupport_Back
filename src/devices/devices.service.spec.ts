/// <reference types="jest" />
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DevicesService, normalizeDeviceStatus } from './devices.service';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceModel: any;
  let usersService: Partial<UsersService>;
  let notificationsService: Partial<NotificationsService>;

  beforeEach(() => {
    deviceModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
    };
    usersService = {
      findOne: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
    };
    service = new DevicesService(deviceModel, usersService as UsersService, notificationsService as NotificationsService);
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
  });

  describe('updateStatus', () => {
    it('updates status to maintenance via the dedicated status endpoint', async () => {
      const updatedDevice = { _id: 'device-1', status: 'maintenance' };
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDevice),
      });

      await expect(
        service.updateStatus('device-1', { status: 'maintenance' } as any),
      ).resolves.toEqual(updatedDevice);
    });

    it('allows an assigned device to transition to maintenance', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'consultant-1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'maintenance', assignedTo: 'consultant-1' }),
      });

      await expect(
        service.updateStatus('device-1', { status: 'maintenance' } as any),
      ).resolves.toMatchObject({ status: 'maintenance', assignedTo: 'consultant-1' });
    });

    it('throws NotFoundException when device does not exist', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateStatus('nonexistent', { status: 'maintenance' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('allocateDevice', () => {
    it('rejects allocation when the device is not available', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'assigned' }),
      });

      await expect(
        service.allocateDevice('device-1', 'consultant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows allocation to an admin user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'admin-1',
        role: Role.ADMIN,
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          status: 'assigned',
          assignedTo: 'admin-1',
        }),
      });

      await expect(
        service.allocateDevice('device-1', 'admin-1', 'assigner-1'),
      ).resolves.toEqual({
        _id: 'device-1',
        status: 'assigned',
        assignedTo: 'admin-1',
      });
    });

    it('allows allocation to a consultant user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue({
        _id: 'consultant-1',
        role: Role.CONSULTANT,
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          status: 'assigned',
          assignedTo: 'consultant-1',
        }),
      });

      await expect(
        service.allocateDevice('device-1', 'consultant-1', 'assigner-1'),
      ).resolves.toEqual({
        _id: 'device-1',
        status: 'assigned',
        assignedTo: 'consultant-1',
      });
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
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });
      (usersService.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.allocateDevice('device-1', 'nonexistent-user'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnDevice', () => {
    it('allows returning an assigned device', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'consultant-1' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'device-1',
          status: 'available',
          assignedTo: null,
        }),
      });

      await expect(
        service.returnDevice('device-1'),
      ).resolves.toMatchObject({ status: 'available', assignedTo: null });
    });

    it('throws BadRequestException when device is not assigned', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'available' }),
      });

      await expect(
        service.returnDevice('device-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user is not the assigned user', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'other-user' }),
      });
      deviceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn(),
      });

      await expect(
        service.returnDevice('device-1'),
      ).rejects.toThrow(BadRequestException);
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

  describe('findAll', () => {
    it('returns all devices with pagination', async () => {
      const mockDevices = [
        { _id: 'device-1', name: 'Laptop 1' },
        { _id: 'device-2', name: 'Laptop 2' },
      ];
      deviceModel.find.mockReturnValue({
        clone: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(2),
        }),
      });

      const result = await service.findAll('1', '10');
      expect(result.devices).toEqual(mockDevices);
      expect(result.total).toBe(2);
    });

    it('applies filters when provided', async () => {
      const mockDevices = [{ _id: 'device-1', name: 'Laptop 1', status: 'available' }];
      deviceModel.find.mockReturnValue({
        or: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDevices),
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(1),
        }),
      });

      await service.findAll('1', '10', undefined, 'available');
      expect(deviceModel.find).toHaveBeenCalled();
    });
  });
});
