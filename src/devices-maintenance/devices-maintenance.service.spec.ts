/// <reference types="jest" />
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DevicesMaintenanceService } from './devices-maintenance.service';
import { MaintenanceTypeLabels } from './device-maintenance.schema';

describe('DevicesMaintenanceService', () => {
  let service: DevicesMaintenanceService;
  let maintenanceModel: any;
  let deviceModel: any;

  beforeEach(() => {
    maintenanceModel = jest.fn();
    maintenanceModel.find = jest.fn();
    maintenanceModel.findById = jest.fn();
    maintenanceModel.findOne = jest.fn();
    maintenanceModel.findByIdAndUpdate = jest.fn();
    maintenanceModel.findByIdAndDelete = jest.fn();
    maintenanceModel.distinct = jest.fn();

    deviceModel = jest.fn();
    deviceModel.findById = jest.fn();
    deviceModel.find = jest.fn();

    service = new DevicesMaintenanceService(maintenanceModel, deviceModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const deviceId = 'device-1';
    const startDate = '2026-01-01';
    const endDate = '2026-12-31';

    it('throws NotFoundException if device not found', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.create(deviceId, startDate, endDate),
      ).rejects.toThrow(NotFoundException);
      expect(deviceModel.findById).toHaveBeenCalledWith(deviceId);
    });

    it('throws BadRequestException if maintenance already exists for device', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'device-1' }),
      });
      maintenanceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'maint-1' }),
      });

      await expect(
        service.create(deviceId, startDate, endDate),
      ).rejects.toThrow(BadRequestException);
      expect(maintenanceModel.findOne).toHaveBeenCalledWith({ deviceId: deviceId as any });
    });

    it('creates maintenance with default maintenanceType', async () => {
      const device = { _id: deviceId };
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(device),
      });
      maintenanceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockSave = jest.fn().mockResolvedValue({
        _id: 'maint-1',
        deviceId,
        maintenanceType: 'maintenance_preventive',
      });
      maintenanceModel.mockReturnValue({ save: mockSave });

      const result = await service.create(deviceId, startDate, endDate);

      expect(maintenanceModel).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId,
          maintenanceType: 'maintenance_preventive',
        }),
      );
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ _id: 'maint-1' }),
      );
    });

    it('creates maintenance with custom maintenanceType', async () => {
      deviceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: deviceId }),
      });
      maintenanceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockSave = jest.fn().mockResolvedValue({
        _id: 'maint-2',
        deviceId,
        maintenanceType: 'maintenance_corrective',
      });
      maintenanceModel.mockReturnValue({ save: mockSave });

      const result = await service.create(
        deviceId,
        startDate,
        endDate,
        'maintenance_corrective',
      );

      expect(maintenanceModel).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId,
          maintenanceType: 'maintenance_corrective',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ _id: 'maint-2' }),
      );
    });
  });

  describe('findAll', () => {
    const mockRecords = [
      { _id: '1', nextMaintenanceDate: new Date('2026-06-15') },
      { _id: '2', nextMaintenanceDate: new Date('2026-12-01') },
    ];

    function createMockQuery(resolvedValue: any) {
      return {
        populate: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(resolvedValue),
      };
    }

    it('returns all with populate and sort by nextMaintenanceDate', async () => {
      const mockQuery = createMockQuery(mockRecords);
      maintenanceModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(maintenanceModel.find).toHaveBeenCalled();
      expect(mockQuery.populate).toHaveBeenCalledWith('deviceId');
      expect(mockQuery.sort).toHaveBeenCalledWith({ nextMaintenanceDate: 1 });
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(mockRecords);
    });

    it('filters by month and year when both provided', async () => {
      const mockQuery = createMockQuery(mockRecords);
      maintenanceModel.find.mockReturnValue(mockQuery);

      await service.findAll(6, 2026);

      expect(mockQuery.where).toHaveBeenCalledWith({
        nextMaintenanceDate: {
          $gte: new Date(2026, 5, 1, 0, 0, 0, 0),
          $lte: new Date(2026, 6, 0, 23, 59, 59, 999),
        },
      });
      expect(mockQuery.populate).toHaveBeenCalledWith('deviceId');
      expect(mockQuery.sort).toHaveBeenCalledWith({ nextMaintenanceDate: 1 });
    });

    it('filters by year only when only year provided', async () => {
      const mockQuery = createMockQuery(mockRecords);
      maintenanceModel.find.mockReturnValue(mockQuery);

      await service.findAll(undefined, 2026);

      expect(mockQuery.where).toHaveBeenCalledWith({
        nextMaintenanceDate: {
          $gte: new Date(2026, 0, 1, 0, 0, 0, 0),
          $lte: new Date(2026, 11, 31, 23, 59, 59, 999),
        },
      });
    });

    it('does not filter when month is provided without year', async () => {
      const mockQuery = createMockQuery(mockRecords);
      maintenanceModel.find.mockReturnValue(mockQuery);

      await service.findAll(6, undefined);

      expect(mockQuery.where).not.toHaveBeenCalled();
      expect(mockQuery.populate).toHaveBeenCalledWith('deviceId');
      expect(mockQuery.sort).toHaveBeenCalledWith({ nextMaintenanceDate: 1 });
    });
  });

  describe('findByDeviceId', () => {
    it('returns maintenance when found', async () => {
      const mockMaintenance = { _id: 'maint-1', deviceId: 'device-1' };
      maintenanceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMaintenance),
      });

      const result = await service.findByDeviceId('device-1');

      expect(maintenanceModel.findOne).toHaveBeenCalledWith({
        deviceId: 'device-1' as any,
      });
      expect(result).toEqual(mockMaintenance);
    });

    it('throws NotFoundException when not found', async () => {
      maintenanceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findByDeviceId('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns maintenance with populate when found', async () => {
      const mockMaintenance = { _id: 'maint-1', deviceId: { _id: 'device-1' } };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMaintenance),
      };
      maintenanceModel.findById.mockReturnValue(mockQuery);

      const result = await service.findById('maint-1');

      expect(maintenanceModel.findById).toHaveBeenCalledWith('maint-1');
      expect(mockQuery.populate).toHaveBeenCalledWith('deviceId');
      expect(result).toEqual(mockMaintenance);
    });

    it('throws NotFoundException when not found', async () => {
      maintenanceModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findById('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const id = 'maint-1';
    const existingMaintenance = {
      maintenanceType: 'maintenance_preventive',
      endDate: new Date('2026-12-31'),
    };

    beforeEach(() => {
      maintenanceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingMaintenance),
      });
    });

    it('throws NotFoundException if not found', async () => {
      maintenanceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(id, { maintenanceType: 'maintenance_corrective' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates maintenanceType with modification history', async () => {
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMaintenance,
          maintenanceType: 'maintenance_corrective',
        }),
      });

      const result = await service.update(id, {
        maintenanceType: 'maintenance_corrective',
      });

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: { maintenanceType: 'maintenance_corrective' },
          $push: {
            modifications: {
              $each: [
                {
                  field: 'Type de maintenance',
                  oldValue: 'Maintenance préventive',
                  newValue: 'Maintenance corrective',
                  date: expect.any(Date),
                  action: 'Modification',
                },
              ],
            },
          },
        },
        { returnDocument: 'after' },
      );
      expect(result).toEqual(
        expect.objectContaining({ maintenanceType: 'maintenance_corrective' }),
      );
    });

    it('updates endDate with modification history', async () => {
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMaintenance,
          endDate: new Date('2027-06-30'),
        }),
      });

      const result = await service.update(id, {
        endDate: '2027-06-30',
      });

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            endDate: new Date('2027-06-30'),
            nextMaintenanceDate: new Date('2027-06-30'),
          },
          $push: {
            modifications: {
              $each: [
                {
                  field: 'Date de fin',
                  oldValue: '31/12/2026',
                  newValue: '30/06/2027',
                  date: expect.any(Date),
                  action: 'Modification',
                },
              ],
            },
          },
        },
        { returnDocument: 'after' },
      );
      expect(result).toEqual(
        expect.objectContaining({ endDate: new Date('2027-06-30') }),
      );
    });

    it('updates both maintenanceType and endDate', async () => {
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMaintenance,
          maintenanceType: 'inspection',
          endDate: new Date('2027-03-15'),
        }),
      });

      await service.update(id, {
        maintenanceType: 'inspection',
        endDate: '2027-03-15',
      });

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            maintenanceType: 'inspection',
            endDate: new Date('2027-03-15'),
            nextMaintenanceDate: new Date('2027-03-15'),
          },
          $push: {
            modifications: {
              $each: [
                {
                  field: 'Type de maintenance',
                  oldValue: 'Maintenance préventive',
                  newValue: 'Inspection',
                  date: expect.any(Date),
                  action: 'Modification',
                },
                {
                  field: 'Date de fin',
                  oldValue: '31/12/2026',
                  newValue: '15/03/2027',
                  date: expect.any(Date),
                  action: 'Modification',
                },
              ],
            },
          },
        },
        { returnDocument: 'after' },
      );
    });

    it('does not add modification when maintenanceType is the same value', async () => {
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingMaintenance),
      });

      await service.update(id, {
        maintenanceType: 'maintenance_preventive',
      });

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: { maintenanceType: 'maintenance_preventive' },
        },
        { returnDocument: 'after' },
      );
    });

    it('does not add modification when endDate produces same locale string', async () => {
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingMaintenance),
      });

      await service.update(id, {
        endDate: '2026-12-31',
      });

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            endDate: new Date('2026-12-31'),
            nextMaintenanceDate: new Date('2026-12-31'),
          },
        },
        { returnDocument: 'after' },
      );
    });
  });

  describe('markAsMaintained', () => {
    const id = 'maint-1';
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-12-31');

    it('throws NotFoundException if initial findById returns null', async () => {
      maintenanceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.markAsMaintained(id),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates lastMaintenanceDate, shifts dates forward, adds modification', async () => {
      const maintenance = {
        _id: id,
        startDate,
        endDate,
        maintenanceType: 'maintenance_preventive',
      };
      maintenanceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(maintenance),
      });

      const updatedDoc = {
        ...maintenance,
        lastMaintenanceDate: new Date(),
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + (endDate.getTime() - startDate.getTime())),
        nextMaintenanceDate: new Date(new Date().getTime() + (endDate.getTime() - startDate.getTime())),
      };
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDoc),
      });

      const result = await service.markAsMaintained(id);

      expect(maintenanceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            lastMaintenanceDate: expect.any(Date),
            startDate: expect.any(Date),
            endDate: expect.any(Date),
            nextMaintenanceDate: expect.any(Date),
          },
          $push: {
            modifications: {
              field: 'Maintenance effectuée',
              oldValue: 'Fin prévue: 31/12/2026',
              newValue: expect.any(String),
              date: expect.any(Date),
              action: 'Maintenance effectuée',
            },
          },
        },
        { returnDocument: 'after' },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('throws NotFoundException when findByIdAndUpdate returns null', async () => {
      maintenanceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: id,
          startDate,
          endDate,
        }),
      });
      maintenanceModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.markAsMaintained(id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes and returns success message', async () => {
      maintenanceModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'maint-1' }),
      });

      const result = await service.remove('maint-1');

      expect(maintenanceModel.findByIdAndDelete).toHaveBeenCalledWith('maint-1');
      expect(result).toEqual({
        message: 'Maintenance schedule deleted successfully',
      });
    });

    it('throws NotFoundException when not found', async () => {
      maintenanceModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.remove('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDevicesWithoutMaintenance', () => {
    it('returns devices without maintenance records', async () => {
      const maintenanceDeviceIds = ['device-1', 'device-2'];
      maintenanceModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue(maintenanceDeviceIds),
      });

      const devicesWithoutMaintenance = [
        { _id: 'device-3', name: 'Laptop' },
        { _id: 'device-4', name: 'Monitor' },
      ];
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(devicesWithoutMaintenance),
      });

      const result = await service.getDevicesWithoutMaintenance();

      expect(maintenanceModel.distinct).toHaveBeenCalledWith('deviceId');
      expect(deviceModel.find).toHaveBeenCalledWith({
        _id: { $nin: maintenanceDeviceIds },
      });
      expect(result).toEqual(devicesWithoutMaintenance);
    });

    it('returns all devices when no maintenance records exist', async () => {
      maintenanceModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const allDevices = [
        { _id: 'device-1', name: 'Laptop' },
        { _id: 'device-2', name: 'Monitor' },
      ];
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(allDevices),
      });

      const result = await service.getDevicesWithoutMaintenance();

      expect(deviceModel.find).toHaveBeenCalledWith({
        _id: { $nin: [] },
      });
      expect(result).toEqual(allDevices);
    });
  });
});
