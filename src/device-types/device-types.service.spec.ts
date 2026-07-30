/// <reference types="jest" />
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeviceTypesService } from './device-types.service';

describe('DeviceTypesService', () => {
  let service: DeviceTypesService;
  let deviceTypeModel: any;

  beforeEach(() => {
    deviceTypeModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      insertMany: jest.fn(),
    };
    service = new DeviceTypesService(deviceTypeModel);
  });

  function mockFindOneResolved(val: any) {
    deviceTypeModel.findOne.mockReturnValue(Promise.resolve(val));
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée un nouveau type avec un nom trimé', async () => {
      const created = { _id: 'type-1', name: 'Laptop', description: '' };
      mockFindOneResolved(null);
      deviceTypeModel.create.mockResolvedValue(created);

      const result = await service.create('  Laptop  ');

      expect(deviceTypeModel.findOne).toHaveBeenCalledWith({ name: 'Laptop' });
      expect(deviceTypeModel.create).toHaveBeenCalledWith({ name: 'Laptop', description: '' });
      expect(result).toEqual(created);
    });

    it('crée un type avec une description fournie', async () => {
      const created = { _id: 'type-2', name: 'Printer', description: 'Impression réseau' };
      mockFindOneResolved(null);
      deviceTypeModel.create.mockResolvedValue(created);

      const result = await service.create('Printer', 'Impression réseau');

      expect(deviceTypeModel.create).toHaveBeenCalledWith({ name: 'Printer', description: 'Impression réseau' });
      expect(result).toEqual(created);
    });

    it('lève ConflictException quand le nom existe déjà', async () => {
      const existing = { _id: 'type-1', name: 'Laptop' };
      mockFindOneResolved(existing);

      await expect(service.create('Laptop')).rejects.toThrow(ConflictException);
      expect(deviceTypeModel.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retourne les types triés par nom par défaut', async () => {
      const types = [{ _id: '1', name: 'Desktop' }, { _id: '2', name: 'Laptop' }];
      const mockQuery = { sort: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(types) };
      deviceTypeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(mockQuery.sort).toHaveBeenCalledWith({ name: 1 });
      expect(result).toEqual(types);
    });

    it('retourne les types triés par createdAt décroissant', async () => {
      const types = [{ _id: '2', name: 'Laptop' }, { _id: '1', name: 'Desktop' }];
      const mockQuery = { sort: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(types) };
      deviceTypeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll('desc');

      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(types);
    });

    it('retourne les types triés par createdAt croissant', async () => {
      const types = [{ _id: '1', name: 'Desktop' }, { _id: '2', name: 'Laptop' }];
      const mockQuery = { sort: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(types) };
      deviceTypeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll('asc');

      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual(types);
    });
  });

  describe('findOne', () => {
    it('retourne un type quand il est trouvé', async () => {
      const doc = { _id: 'type-1', name: 'Laptop' };
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const result = await service.findOne('type-1');

      expect(result).toEqual(doc);
    });

    it('lève NotFoundException quand le type est introuvable', async () => {
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('met à jour le nom d\'un type sans changer la description', async () => {
      const doc = { _id: 'type-1', name: 'Laptop', description: 'Ancienne description', save: jest.fn() };
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      mockFindOneResolved(null);
      doc.save.mockResolvedValue({ ...doc, name: 'Laptop Pro' });

      const result = await service.update('type-1', 'Laptop Pro');

      expect(doc.name).toBe('Laptop Pro');
      expect(doc.description).toBe('Ancienne description');
      expect(doc.save).toHaveBeenCalled();
      expect(result.name).toBe('Laptop Pro');
    });

    it('met à jour le nom et la description d\'un type', async () => {
      const doc = { _id: 'type-1', name: 'Laptop', description: '', save: jest.fn() };
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      mockFindOneResolved(null);
      doc.save.mockResolvedValue({ ...doc, name: 'Laptop Pro', description: 'Ordinateur portable pro' });

      const result = await service.update('type-1', 'Laptop Pro', 'Ordinateur portable pro');

      expect(doc.name).toBe('Laptop Pro');
      expect(doc.description).toBe('Ordinateur portable pro');
      expect(doc.save).toHaveBeenCalled();
    });

    it('lève NotFoundException quand le type à mettre à jour est introuvable', async () => {
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.update('nonexistent', 'New Name')).rejects.toThrow(NotFoundException);
    });

    it('lève ConflictException quand un autre type porte déjà le même nom', async () => {
      const doc = { _id: 'type-1', name: 'Laptop', save: jest.fn() };
      const duplicate = { _id: 'type-2', name: 'Laptop Pro' };
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      mockFindOneResolved(duplicate);

      await expect(service.update('type-1', 'Laptop Pro')).rejects.toThrow(ConflictException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('ne lève pas ConflictException si le nom existe sur le même document', async () => {
      const doc = { _id: 'type-1', name: 'Laptop', description: '', save: jest.fn() };
      deviceTypeModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      mockFindOneResolved(null);
      doc.save.mockResolvedValue({ ...doc });

      const result = await service.update('type-1', 'Laptop');

      expect(result).toBeDefined();
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('supprime un type avec succès', async () => {
      deviceTypeModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'type-1' }) });

      const result = await service.remove('type-1');

      expect(result).toEqual({ message: 'Type supprimé avec succès' });
    });

    it('lève NotFoundException quand le type à supprimer est introuvable', async () => {
      deviceTypeModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('seed', () => {
    it('n\'insère rien si des types existent déjà', async () => {
      deviceTypeModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(5) });

      await service.seed();

      expect(deviceTypeModel.insertMany).not.toHaveBeenCalled();
    });

    it('insère les 12 types par défaut quand la collection est vide', async () => {
      deviceTypeModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.seed();

      expect(deviceTypeModel.insertMany).toHaveBeenCalledWith([
        { name: 'Laptop', description: '' },
        { name: 'Desktop', description: '' },
        { name: 'Mobile', description: '' },
        { name: 'Tablet', description: '' },
        { name: 'Printer', description: '' },
        { name: 'Scanner', description: '' },
        { name: 'Monitor', description: '' },
        { name: 'Router', description: '' },
        { name: 'Switch', description: '' },
        { name: 'Access Point', description: '' },
        { name: 'Camera', description: '' },
        { name: 'Projecteur', description: '' },
      ]);
    });
  });
});
