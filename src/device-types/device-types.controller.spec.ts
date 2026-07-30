import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTypesController } from './device-types.controller';
import { DeviceTypesService } from './device-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '../users/user.schema';

describe('DeviceTypesController', () => {
  let controller: DeviceTypesController;
  let service: jest.Mocked<DeviceTypesService>;

  const adminReq = { user: { userId: 'admin-1', role: Role.ADMIN } };
  const itReq = { user: { userId: 'it-1', role: Role.IT } };
  const consultantReq = { user: { userId: 'cons-1', role: Role.CONSULTANT } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceTypesController],
      providers: [
        {
          provide: DeviceTypesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            seed: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<DeviceTypesController>(DeviceTypesController);
    service = module.get(DeviceTypesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST / — create', () => {
    it('permet à un admin de créer un type', async () => {
      const created = { _id: 'type-1', name: 'Laptop', description: '' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(adminReq as any, { name: 'Laptop' });

      expect(service.create).toHaveBeenCalledWith('Laptop', undefined);
      expect(result).toEqual(created);
    });

    it('permet à un membre IT de créer un type', async () => {
      const created = { _id: 'type-2', name: 'Printer', description: 'Réseau' };
      service.create.mockResolvedValue(created);

      const result = await controller.create(itReq as any, { name: 'Printer', description: 'Réseau' });

      expect(service.create).toHaveBeenCalledWith('Printer', 'Réseau');
      expect(result).toEqual(created);
    });

    it('lève ForbiddenException pour un consultant', async () => {
      await expect(
        controller.create(consultantReq as any, { name: 'Laptop' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException quand le rôle est manquant', async () => {
      const reqWithoutRole = { user: { userId: 'user-1' } };

      await expect(
        controller.create(reqWithoutRole as any, { name: 'Laptop' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
    });


  });

  describe('GET / — findAll', () => {
    it('retourne tous les types sans tri', async () => {
      const types = [{ _id: '1', name: 'Desktop' }, { _id: '2', name: 'Laptop' }];
      service.findAll.mockResolvedValue(types);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(types);
    });

    it('retourne les types avec un tri par date décroissante', async () => {
      const types = [{ _id: '2', name: 'Laptop' }, { _id: '1', name: 'Desktop' }];
      service.findAll.mockResolvedValue(types);

      const result = await controller.findAll('desc');

      expect(service.findAll).toHaveBeenCalledWith('desc');
      expect(result).toEqual(types);
    });
  });

  describe('GET /:id — findOne', () => {
    it('retourne un type par son id', async () => {
      const doc = { _id: 'type-1', name: 'Laptop' };
      service.findOne.mockResolvedValue(doc);

      const result = await controller.findOne('type-1');

      expect(service.findOne).toHaveBeenCalledWith('type-1');
      expect(result).toEqual(doc);
    });
  });

  describe('PATCH /:id — update', () => {
    it('permet à un admin de mettre à jour un type', async () => {
      const updated = { _id: 'type-1', name: 'Laptop Pro', description: '' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(adminReq as any, 'type-1', { name: 'Laptop Pro' });

      expect(service.update).toHaveBeenCalledWith('type-1', 'Laptop Pro', undefined);
      expect(result).toEqual(updated);
    });

    it('permet à un membre IT de mettre à jour un type', async () => {
      const updated = { _id: 'type-1', name: 'Laptop', description: 'Pro' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(itReq as any, 'type-1', { name: 'Laptop', description: 'Pro' });

      expect(service.update).toHaveBeenCalledWith('type-1', 'Laptop', 'Pro');
      expect(result).toEqual(updated);
    });

    it('lève ForbiddenException pour un consultant', async () => {
      await expect(
        controller.update(consultantReq as any, 'type-1', { name: 'Laptop' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id — remove', () => {
    it('permet à un admin de supprimer un type', async () => {
      service.remove.mockResolvedValue({ message: 'Type supprimé avec succès' });

      const result = await controller.remove(adminReq as any, 'type-1');

      expect(service.remove).toHaveBeenCalledWith('type-1');
      expect(result).toEqual({ message: 'Type supprimé avec succès' });
    });

    it('permet à un membre IT de supprimer un type', async () => {
      service.remove.mockResolvedValue({ message: 'Type supprimé avec succès' });

      const result = await controller.remove(itReq as any, 'type-1');

      expect(service.remove).toHaveBeenCalledWith('type-1');
      expect(result).toEqual({ message: 'Type supprimé avec succès' });
    });

    it('lève ForbiddenException pour un consultant', async () => {
      await expect(
        controller.remove(consultantReq as any, 'type-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
