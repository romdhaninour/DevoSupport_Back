/// <reference types="jest" />
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DevicesService, normalizeDeviceStatus } from './devices.service';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceModel: any;
  let usersService: Partial<UsersService>;

  beforeEach(() => {
    deviceModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    usersService = {
      findOne: jest.fn(),
    };
    service = new DevicesService(deviceModel as any, usersService as UsersService);
  });

  it('updates status to maintenance via the dedicated status endpoint', async () => {
    const updatedDevice = { _id: 'device-1', status: 'maintenance' };
    deviceModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }) });
    deviceModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedDevice) });

    await expect(service.updateStatus('device-1', { status: 'maintenance' } as any)).resolves.toEqual(updatedDevice);
  });

  it('rejects allocation when the device is not available', async () => {
    deviceModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned' }) });

    await expect(service.allocateDevice('device-1', 'consultant-1')).rejects.toThrow(BadRequestException);
  });

  it('allows allocation to an admin user', async () => {
    deviceModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'available' }) });
    (usersService.findOne as jest.Mock).mockResolvedValue({ _id: 'admin-1', role: Role.ADMIN });
    deviceModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'device-1', status: 'assigned', assignedTo: 'admin-1' }) });

    await expect(service.allocateDevice('device-1', 'admin-1', 'assigner-1')).resolves.toEqual({ _id: 'device-1', status: 'assigned', assignedTo: 'admin-1' });
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
});
