import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role, Status } from './user.schema';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    nom: 'Doe',
    prenom: 'John',
    email: 'john.doe@example.com',
    role: Role.ADMIN,
    status: Status.ACTIVE,
    isConsultant: false,
    profilePicture: 'https://example.com/pic.jpg',
  };

  const mockReq = {
    user: {
      userId: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findArchived: jest.fn(),
            findConsultants: jest.fn(),
            findByRole: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            activate: jest.fn(),
            deactivate: jest.fn(),
            archive: jest.fn(),
            restore: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user when request user is admin', async () => {
      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      service.create.mockResolvedValue(mockUser);

      const result = await controller.create(mockReq as any, createUserDto);

      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
    });

    it('should throw ForbiddenException when request user is not admin', async () => {
      const nonAdminReq = {
        user: {
          userId: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          role: Role.IT,
          status: Status.ACTIVE,
        },
      };

      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      try {
        await controller.create(nonAdminReq as any, createUserDto);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe('Only admins can create users');
      }
      expect(service.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user role is missing', async () => {
      const reqWithoutRole = {
        user: {
          userId: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          status: Status.ACTIVE,
        },
      };

      const createUserDto = {
        nom: 'Doe',
        prenom: 'John',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
      };

      try {
        await controller.create(reqWithoutRole as any, createUserDto);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
      }
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all users excluding archived by default', async () => {
      const users = [mockUser, { ...mockUser, email: 'jane@example.com' }];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll(mockReq as any);

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledWith(false);
    });

    it('should return all users including archived when query param is true', async () => {
      const users = [mockUser, { ...mockUser, status: Status.ARCHIVED }];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll(mockReq as any, 'true');

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledWith(true);
    });

    it('should exclude archived when query param is not true', async () => {
      const users = [mockUser];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll(mockReq as any, 'false');

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledWith(false);
    });
  });

  describe('findArchived', () => {
    it('should return archived users', async () => {
      const archivedUsers = [{ ...mockUser, status: Status.ARCHIVED }];
      service.findArchived.mockResolvedValue(archivedUsers);

      const result = await controller.findArchived();

      expect(result).toEqual(archivedUsers);
      expect(service.findArchived).toHaveBeenCalled();
    });
  });

  describe('findConsultants', () => {
    it('should return consultant users', async () => {
      const consultants = [
        { ...mockUser, isConsultant: true, role: Role.IT },
        {
          ...mockUser,
          isConsultant: true,
          role: Role.CONSULTANT,
          email: 'consultant@example.com',
        },
      ];
      service.findConsultants.mockResolvedValue(consultants);

      const result = await controller.findConsultants();

      expect(result).toEqual(consultants);
      expect(service.findConsultants).toHaveBeenCalled();
    });
  });

  describe('findByRole', () => {
    it('should return users by role', async () => {
      const adminUsers = [
        mockUser,
        { ...mockUser, email: 'admin2@example.com' },
      ];
      service.findByRole.mockResolvedValue(adminUsers);

      const result = await controller.findByRole(Role.ADMIN);

      expect(result).toEqual(adminUsers);
      expect(service.findByRole).toHaveBeenCalledWith(Role.ADMIN);
    });
  });

  describe('findOne', () => {
    it('should return a single user by ID', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = { nom: 'Smith' };
      const updatedUser = { ...mockUser, nom: 'Smith' };
      service.update.mockResolvedValue(updatedUser);

      const mockReq = {
        user: {
          userId: '507f1f77bcf86cd799439011',
          role: Role.ADMIN,
        },
      };

      const result = await controller.update(
        mockReq as any,
        '507f1f77bcf86cd799439011',
        updateUserDto,
      );

      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        updateUserDto,
      );
    });
  });

  describe('activate', () => {
    it('should activate a user', async () => {
      const activatedUser = { ...mockUser, status: Status.ACTIVE };
      service.activate.mockResolvedValue(activatedUser);

      const result = await controller.activate('507f1f77bcf86cd799439011');

      expect(result).toEqual(activatedUser);
      expect(service.activate).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      const deactivatedUser = { ...mockUser, status: Status.INACTIVE };
      service.deactivate.mockResolvedValue(deactivatedUser);

      const result = await controller.deactivate('507f1f77bcf86cd799439011');

      expect(result).toEqual(deactivatedUser);
      expect(service.deactivate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });
  });

  describe('archive', () => {
    it('should archive a user', async () => {
      const archivedUser = { ...mockUser, status: Status.ARCHIVED };
      service.archive.mockResolvedValue(archivedUser);

      const result = await controller.archive('507f1f77bcf86cd799439011');

      expect(result).toEqual(archivedUser);
      expect(service.archive).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('restore', () => {
    it('should restore an archived user', async () => {
      const restoredUser = { ...mockUser, status: Status.INACTIVE };
      service.restore.mockResolvedValue(restoredUser);

      const result = await controller.restore('507f1f77bcf86cd799439011');

      expect(result).toEqual(restoredUser);
      expect(service.restore).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      const deleteResult = {
        message: `User ${mockUser.email} deleted successfully`,
      };
      service.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove('507f1f77bcf86cd799439011');

      expect(result).toEqual(deleteResult);
      expect(service.remove).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });
});
