import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role, Status } from './user.schema';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
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
      sub: '507f1f77bcf86cd799439011',
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
            findByEmail: jest.fn(),
            update: jest.fn(),
            activate: jest.fn(),
            deactivate: jest.fn(),
            archive: jest.fn(),
            restore: jest.fn(),
            remove: jest.fn(),
            importUsers: jest.fn(),
            exportUsers: jest.fn(),
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
      expect(service.findAll).toHaveBeenCalledWith(false, undefined);
    });

    it('should return all users including archived when query param is true', async () => {
      const users = [mockUser, { ...mockUser, status: Status.ARCHIVED }];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll(mockReq as any, 'true');

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledWith(true, undefined);
    });

    it('should exclude archived when query param is not true', async () => {
      const users = [mockUser];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll(mockReq as any, 'false');

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledWith(false, undefined);
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

  describe('findCurrentUser', () => {
    it('should return the current user by userId', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const result = await controller.findCurrentUser(mockReq as any);

      expect(service.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockUser);
    });

    it('should fall back to sub when userId is missing', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const req = { user: { sub: 'sub-user-123', role: Role.IT } };
      const result = await controller.findCurrentUser(req as any);

      expect(service.findOne).toHaveBeenCalledWith('sub-user-123');
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

  describe('getProfilePicture', () => {
    it('returns 404 when user has no profile picture', async () => {
      service.findOne.mockResolvedValue({ ...mockUser, profilePicture: undefined } as any);

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.getProfilePicture('user-1', res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Profile picture not found');
    });

    it('returns 404 when user is not found', async () => {
      service.findOne.mockResolvedValue(null as any);

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.getProfilePicture('user-1', res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('fetches and returns the profile picture buffer', async () => {
      service.findOne.mockResolvedValue({
        ...mockUser,
        profilePicture: 'https://example.com/pic.jpg',
      } as any);

      const mockBuffer = Buffer.from('image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.getProfilePicture('user-1', res as any);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('returns 500 when fetch fails', async () => {
      service.findOne.mockResolvedValue({
        ...mockUser,
        profilePicture: 'https://example.com/pic.jpg',
      } as any);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.getProfilePicture('user-1', res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Failed to fetch profile picture');
    });

    it('returns 500 when response is not ok', async () => {
      service.findOne.mockResolvedValue({
        ...mockUser,
        profilePicture: 'https://example.com/pic.jpg',
      } as any);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        headers: { get: jest.fn() },
      });

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.getProfilePicture('user-1', res as any);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = { nom: 'Smith' };
      const updatedUser = { ...mockUser, nom: 'Smith' };
      service.update.mockResolvedValue(updatedUser);

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

    it('should allow users to update their own profile', async () => {
      const nonAdminReq = {
        user: {
          sub: '507f1f77bcf86cd799439011',
          role: Role.CONSULTANT,
        },
      };
      const updateUserDto = { nom: 'Smith' };
      service.update.mockResolvedValue({ ...mockUser, nom: 'Smith' });

      const result = await controller.update(
        nonAdminReq as any,
        '507f1f77bcf86cd799439011',
        updateUserDto,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when non-admin tries to update another user', () => {
      const nonAdminReq = {
        user: {
          sub: 'other-user-id',
          role: Role.CONSULTANT,
        },
      };
      const updateUserDto = { nom: 'Smith' };

      expect(() =>
        controller.update(nonAdminReq as any, '507f1f77bcf86cd799439011', updateUserDto),
      ).toThrow(ForbiddenException);
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

  describe('importUsers', () => {
    it('allows admin to import users', async () => {
      const file = { buffer: Buffer.from('data') };
      const importResult = { success: 5, failed: 0, errors: [] };
      service.importUsers.mockResolvedValue(importResult);

      const result = await controller.importUsers(mockReq as any, file);

      expect(service.importUsers).toHaveBeenCalledWith(file);
      expect(result).toEqual(importResult);
    });

    it('throws ForbiddenException for non-admin users', async () => {
      const nonAdminReq = {
        user: { role: Role.IT },
      };

      await expect(
        controller.importUsers(nonAdminReq as any, { buffer: Buffer.from('') }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no file is uploaded', async () => {
      await expect(
        controller.importUsers(mockReq as any, null),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportUsers', () => {
    it('allows admin to export users', async () => {
      const buffer = Buffer.from('excel data');
      service.exportUsers.mockResolvedValue(buffer);

      const res = {
        send: jest.fn(),
      };

      await controller.exportUsers(mockReq as any, { search: 'john' }, res as any);

      expect(service.exportUsers).toHaveBeenCalledWith('john');
      expect(res.send).toHaveBeenCalledWith(buffer);
    });

    it('throws ForbiddenException for non-admin users', async () => {
      const nonAdminReq = {
        user: { role: Role.IT },
      };
      const res = { send: jest.fn() };

      await expect(
        controller.exportUsers(nonAdminReq as any, {}, res as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
