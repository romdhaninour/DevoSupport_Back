/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { DevicesMaintenanceController } from './devices-maintenance.controller';
import { DevicesMaintenanceService } from './devices-maintenance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('DevicesMaintenanceController', () => {
  let controller: DevicesMaintenanceController;
  let service: Partial<DevicesMaintenanceService>;

  const adminReq = { user: { role: 'ADMIN' } };
  const itReq = { user: { role: 'IT' } };
  const consultantReq = { user: { role: 'CONSULTANT' } };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByDeviceId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      markAsMaintained: jest.fn(),
      remove: jest.fn(),
      getDevicesWithoutMaintenance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesMaintenanceController],
      providers: [
        { provide: DevicesMaintenanceService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DevicesMaintenanceController>(DevicesMaintenanceController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST / (create)', () => {
    const body = {
      deviceId: 'device-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    it('allows ADMIN to create a maintenance schedule', async () => {
      const created = { _id: 'maint-1', ...body };
      (service.create as jest.Mock).mockResolvedValue(created);

      const result = await controller.create(
        adminReq as any,
        body,
      );

      expect(service.create).toHaveBeenCalledWith(
        'device-1',
        '2026-01-01',
        '2026-12-31',
        undefined,
      );
      expect(result).toEqual(created);
    });

    it('allows IT to create a maintenance schedule', async () => {
      (service.create as jest.Mock).mockResolvedValue({ _id: 'maint-1' });

      const result = await controller.create(
        itReq as any,
        { ...body, maintenanceType: 'inspection' },
      );

      expect(service.create).toHaveBeenCalledWith(
        'device-1',
        '2026-01-01',
        '2026-12-31',
        'inspection',
      );
    });

    it('denies CONSULTANT with access denied error', async () => {
      const result = await controller.create(
        consultantReq as any,
        body,
      );

      expect(result).toEqual({ error: 'Access denied' });
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('GET / (findAll)', () => {
    it('returns all maintenance schedules without auth check', async () => {
      const mockResult = [{ _id: 'maint-1' }];
      (service.findAll as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockResult);
    });

    it('parses month and year query params', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([]);

      await controller.findAll('6', '2026');

      expect(service.findAll).toHaveBeenCalledWith(6, 2026);
    });

    it('handles partial query params (year only)', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([]);

      await controller.findAll(undefined, '2026');

      expect(service.findAll).toHaveBeenCalledWith(undefined, 2026);
    });

    it('works for CONSULTANT (public endpoint)', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('GET /devices-without (getDevicesWithoutMaintenance)', () => {
    it('returns devices without maintenance', async () => {
      const mockResult = [{ _id: 'device-3' }];
      (service.getDevicesWithoutMaintenance as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getDevicesWithoutMaintenance();

      expect(service.getDevicesWithoutMaintenance).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('works for CONSULTANT (public endpoint)', async () => {
      (service.getDevicesWithoutMaintenance as jest.Mock).mockResolvedValue([]);

      const result = await controller.getDevicesWithoutMaintenance();

      expect(result).toEqual([]);
    });
  });

  describe('GET /record/:id (findById)', () => {
    it('returns maintenance by record id', async () => {
      const mockRecord = { _id: 'record-1' };
      (service.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await controller.findById('record-1');

      expect(service.findById).toHaveBeenCalledWith('record-1');
      expect(result).toEqual(mockRecord);
    });

    it('works for CONSULTANT (public endpoint)', async () => {
      (service.findById as jest.Mock).mockResolvedValue({});

      const result = await controller.findById('record-1');

      expect(result).toEqual({});
    });
  });

  describe('GET /:deviceId (findOne)', () => {
    it('returns maintenance by device id', async () => {
      const mockMaintenance = { _id: 'maint-1', deviceId: 'device-1' };
      (service.findByDeviceId as jest.Mock).mockResolvedValue(mockMaintenance);

      const result = await controller.findOne('device-1');

      expect(service.findByDeviceId).toHaveBeenCalledWith('device-1');
      expect(result).toEqual(mockMaintenance);
    });

    it('works for CONSULTANT (public endpoint)', async () => {
      (service.findByDeviceId as jest.Mock).mockResolvedValue({});

      const result = await controller.findOne('device-1');

      expect(result).toEqual({});
    });
  });

  describe('PATCH /:id (update)', () => {
    const body = { maintenanceType: 'maintenance_corrective' };

    it('allows ADMIN to update', async () => {
      const updated = { _id: 'maint-1', maintenanceType: 'maintenance_corrective' };
      (service.update as jest.Mock).mockResolvedValue(updated);

      const result = await controller.update(
        adminReq as any,
        'maint-1',
        body,
      );

      expect(service.update).toHaveBeenCalledWith('maint-1', body);
      expect(result).toEqual(updated);
    });

    it('allows IT to update', async () => {
      (service.update as jest.Mock).mockResolvedValue({});

      await controller.update(itReq as any, 'maint-1', body);

      expect(service.update).toHaveBeenCalled();
    });

    it('denies CONSULTANT with access denied error', async () => {
      const result = await controller.update(
        consultantReq as any,
        'maint-1',
        body,
      );

      expect(result).toEqual({ error: 'Access denied' });
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/maintained (markAsMaintained)', () => {
    it('allows ADMIN to mark as maintained', async () => {
      const updated = { _id: 'maint-1', lastMaintenanceDate: new Date() };
      (service.markAsMaintained as jest.Mock).mockResolvedValue(updated);

      const result = await controller.markAsMaintained(
        adminReq as any,
        'maint-1',
      );

      expect(service.markAsMaintained).toHaveBeenCalledWith('maint-1');
      expect(result).toEqual(updated);
    });

    it('allows IT to mark as maintained', async () => {
      (service.markAsMaintained as jest.Mock).mockResolvedValue({});

      await controller.markAsMaintained(itReq as any, 'maint-1');

      expect(service.markAsMaintained).toHaveBeenCalled();
    });

    it('denies CONSULTANT with access denied error', async () => {
      const result = await controller.markAsMaintained(
        consultantReq as any,
        'maint-1',
      );

      expect(result).toEqual({ error: 'Access denied' });
      expect(service.markAsMaintained).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id (remove)', () => {
    it('allows ADMIN to delete', async () => {
      (service.remove as jest.Mock).mockResolvedValue({
        message: 'Maintenance schedule deleted successfully',
      });

      const result = await controller.remove(
        adminReq as any,
        'maint-1',
      );

      expect(service.remove).toHaveBeenCalledWith('maint-1');
      expect(result).toEqual({
        message: 'Maintenance schedule deleted successfully',
      });
    });

    it('allows IT to delete', async () => {
      (service.remove as jest.Mock).mockResolvedValue({ message: 'ok' });

      await controller.remove(itReq as any, 'maint-1');

      expect(service.remove).toHaveBeenCalled();
    });

    it('denies CONSULTANT with access denied error', async () => {
      const result = await controller.remove(
        consultantReq as any,
        'maint-1',
      );

      expect(result).toEqual({ error: 'Access denied' });
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
