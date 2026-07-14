/// <reference types="jest" />
import { ForbiddenException } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Role } from '../users/user.schema';

describe('DevicesController', () => {
  let controller: DevicesController;
  let service: Partial<DevicesService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
    };
    controller = new DevicesController(service as DevicesService);
  });

  it('allows admins to create a device', async () => {
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
    const createdDevice = { ...dto, id: 'device-1' };
    (service.create as jest.Mock).mockResolvedValue(createdDevice);

    await expect(
      controller.create({ user: { role: Role.ADMIN } }, dto as any, null),
    ).resolves.toEqual(createdDevice);
  });

  it('allows IT staff to create a device', async () => {
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
    const createdDevice = { ...dto, id: 'device-1' };
    (service.create as jest.Mock).mockResolvedValue(createdDevice);

    await expect(
      controller.create({ user: { role: Role.IT } }, dto as any, null),
    ).resolves.toEqual(createdDevice);
  });
});
