import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User, Role, Status } from './user.schema';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';

const mockWorkbook = {
  xlsx: {
    load: jest.fn().mockResolvedValue(undefined),
    writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
  },
  addWorksheet: jest.fn().mockReturnValue({
    getRow: jest.fn().mockReturnValue({ font: {}, fill: {}, alignment: {} }),
    addRow: jest.fn().mockReturnValue({ getCell: jest.fn().mockReturnValue({ font: {} }) }),
    eachRow: jest.fn(),
    columns: [],
  }),
  getWorksheet: jest.fn(),
  worksheets: [],
};
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => mockWorkbook),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<User>>;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    nom: 'Doe',
    prenom: 'John',
    email: 'john.doe@example.com',
    role: Role.ADMIN,
    status: Status.ACTIVE,
    isConsultant: false,
    profilePicture: 'https://example.com/pic.jpg',
    save: jest.fn(),
  };

  class MockUserModel {
    _id: string;
    nom: string;
    prenom: string;
    email: string;
    role: Role;
    status: Status;
    isConsultant: boolean;
    profilePicture?: string;
    save: jest.Mock;

    constructor(data: any) {
      this._id = data._id || '507f1f77bcf86cd799439011';
      this.nom = data.nom;
      this.prenom = data.prenom;
      this.email = data.email;
      this.role = data.role;
      this.status = data.status;
      this.isConsultant = data.isConsultant;
      this.profilePicture = data.profilePicture;
      this.save = jest.fn().mockResolvedValue(this);
    }

    static find = jest.fn();
    static findById = jest.fn();
    static findByIdAndUpdate = jest.fn();
    static findByIdAndDelete = jest.fn();
    static findOne = jest.fn();
    static create = jest.fn().mockImplementation((data: any) => {
      return Promise.resolve(
        new MockUserModel({ ...data, _id: '507f1f77bcf86cd799439011' }),
      );
    });
  }

  const mockUserModel = MockUserModel as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      mockUserModel.findOne.mockResolvedValue(null);
      const createdUser = {
        ...mockUser,
        ...createUserDto,
        status: Status.INACTIVE,
      };
      mockUserModel.create.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(
        expect.objectContaining({
          ...createUserDto,
          status: Status.INACTIVE,
        }),
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: createUserDto.email,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        `Email ${createUserDto.email} already exists`,
      );
    });

    it('should set status to INACTIVE by default', async () => {
      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      mockUserModel.findOne.mockResolvedValue(null);
      const createdUser = {
        ...mockUser,
        ...createUserDto,
        status: Status.INACTIVE,
      };
      mockUserModel.create.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(result.status).toBe(Status.INACTIVE);
    });
  });

  describe('findAll', () => {
    it('should return all users excluding archived by default', async () => {
      const users = [mockUser, { ...mockUser, email: 'jane@example.com' }];
      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(users),
        }),
      } as any);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        status: { $ne: Status.ARCHIVED },
      });
    });

    it('should return all users including archived when flag is true', async () => {
      const users = [mockUser, { ...mockUser, status: Status.ARCHIVED }];
      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(users),
        }),
      } as any);

      const result = await service.findAll(true);

      expect(result).toEqual(users);
      expect(mockUserModel.find).toHaveBeenCalledWith({});
    });
  });

  describe('findArchived', () => {
    it('should return only archived users', async () => {
      const archivedUsers = [{ ...mockUser, status: Status.ARCHIVED }];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(archivedUsers),
      } as any);

      const result = await service.findArchived();

      expect(result).toEqual(archivedUsers);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        status: Status.ARCHIVED,
      });
    });
  });

  describe('findByRole', () => {
    it('should return users by role excluding archived', async () => {
      const adminUsers = [
        mockUser,
        { ...mockUser, email: 'admin2@example.com' },
      ];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(adminUsers),
      } as any);

      const result = await service.findByRole(Role.ADMIN);

      expect(result).toEqual(adminUsers);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        role: Role.ADMIN,
        status: { $ne: Status.ARCHIVED },
      });
    });
  });

  describe('findConsultants', () => {
    it('should return consultant and admin users excluding archived', async () => {
      const consultants = [
        { ...mockUser, isConsultant: true, role: Role.IT },
        {
          ...mockUser,
          isConsultant: true,
          role: Role.CONSULTANT,
          email: 'consultant@example.com',
        },
        { ...mockUser, role: Role.ADMIN, email: 'admin@example.com' },
      ];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(consultants),
      } as any);

      const result = await service.findConsultants();

      expect(result).toEqual(consultants);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        $or: [
          { role: Role.IT },
          { role: Role.CONSULTANT },
          { role: Role.ADMIN },
          { isConsultant: true },
        ],
        status: { $ne: Status.ARCHIVED },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        'User #507f1f77bcf86cd799439011 not found',
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const result = await service.findByEmail('john.doe@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
      });
    });

    it('should normalize email to lowercase', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      await service.findByEmail('John.Doe@Example.COM');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
      });
    });

    it('should trim whitespace from email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      await service.findByEmail('  john.doe@example.com  ');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
      });
    });

    it('should return null if user not found', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateUserDto = { nom: 'Smith' };
      const updatedUser = { ...mockUser, nom: 'Smith' };

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser),
      } as any);

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        updateUserDto,
      );

      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        updateUserDto,
        { returnDocument: 'after' },
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.update('507f1f77bcf86cd799439011', { nom: 'Smith' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should activate a user', async () => {
      const activatedUser = { ...mockUser, status: Status.ACTIVE };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activatedUser),
      } as any);

      const result = await service.activate('507f1f77bcf86cd799439011');

      expect(result.status).toBe(Status.ACTIVE);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { status: Status.ACTIVE },
        { returnDocument: 'after' },
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      const deactivatedUser = { ...mockUser, status: Status.INACTIVE };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deactivatedUser),
      } as any);

      const result = await service.deactivate('507f1f77bcf86cd799439011');

      expect(result.status).toBe(Status.INACTIVE);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { status: Status.INACTIVE },
        { returnDocument: 'after' },
      );
    });
  });

  describe('archive', () => {
    it('should archive a user', async () => {
      const archivedUser = { ...mockUser, status: Status.ARCHIVED };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(archivedUser),
      } as any);

      const result = await service.archive('507f1f77bcf86cd799439011');

      expect(result.status).toBe(Status.ARCHIVED);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { status: Status.ARCHIVED },
        { returnDocument: 'after' },
      );
    });
  });

  describe('restore', () => {
    it('should restore an archived user', async () => {
      const restoredUser = { ...mockUser, status: Status.INACTIVE };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(restoredUser),
      } as any);

      const result = await service.restore('507f1f77bcf86cd799439011');

      expect(result.status).toBe(Status.INACTIVE);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { status: Status.INACTIVE },
        { returnDocument: 'after' },
      );
    });
  });

  describe('remove', () => {
    it('should delete a user successfully', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const result = await service.remove('507f1f77bcf86cd799439011');

      expect(result).toEqual({
        message: `User ${mockUser.email} deleted successfully`,
      });
      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('importUsers', () => {
    it('throws BadRequestException when no worksheet found', async () => {
      mockWorkbook.getWorksheet.mockReturnValue(undefined);
      mockWorkbook.worksheets = [];

      const file = { buffer: Buffer.from('') };

      await expect(service.importUsers(file)).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportUsers', () => {
    it('returns a buffer with exported users', async () => {
      const mockUsers = [
        {
          nom: 'Doe',
          prenom: 'John',
          email: 'john@test.com',
          role: Role.ADMIN,
          status: Status.ACTIVE,
        },
      ];

      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers),
        or: jest.fn().mockReturnThis(),
      } as any);

      const result = await service.exportUsers();

      expect(result).toBeInstanceOf(Buffer);
    });

    it('applies search filter when provided', async () => {
      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        or: jest.fn().mockReturnThis(),
      } as any);

      await service.exportUsers('john');

      expect(mockUserModel.find).toHaveBeenCalled();
    });

    it('filters out archived users', async () => {
      mockUserModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        or: jest.fn().mockReturnThis(),
      } as any);

      await service.exportUsers();

      expect(mockUserModel.find).toHaveBeenCalledWith({
        status: { $ne: Status.ARCHIVED },
      });
    });
  });
});
