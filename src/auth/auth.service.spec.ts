import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User, Role, Status } from '../users/user.schema';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: any = {
    _id: '507f1f77bcf86cd799439011',
    nom: 'Doe',
    prenom: 'John',
    email: 'john.doe@example.com',
    role: Role.ADMIN,
    status: Status.ACTIVE,
    isConsultant: false,
    profilePicture: 'https://example.com/pic.jpg',
  };

  const mockJwtPayload = {
    email: 'john.doe@example.com',
    sub: mockUser._id,
    role: Role.ADMIN,
    status: Status.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGoogleUser', () => {
    it('should return not_registered when email is missing', async () => {
      const profile = { email: null, firstName: 'John', lastName: 'Doe' };

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'not_registered' });
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('should return not_registered when email is empty string', async () => {
      const profile = { email: '', firstName: 'John', lastName: 'Doe' };

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'not_registered' });
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('should return not_registered when user does not exist', async () => {
      const profile = {
        email: 'nonexistent@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'not_registered' });
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
    });

    it('should return inactive when user exists but is not active', async () => {
      const inactiveUser = { ...mockUser, status: Status.INACTIVE };
      const profile = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(inactiveUser);

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'inactive', user: inactiveUser });
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
      );
    });

    it('should return inactive when user is archived', async () => {
      const archivedUser = { ...mockUser, status: Status.ARCHIVED };
      const profile = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(archivedUser);

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'inactive', user: archivedUser });
    });

    it('should update profile picture when it has changed', async () => {
      const userWithOldPic = {
        ...mockUser,
        profilePicture: 'old-pic.jpg',
        _id: '507f1f77bcf86cd799439011',
      };
      const userWithNewPic = {
        ...mockUser,
        profilePicture: 'new-pic.jpg',
        _id: '507f1f77bcf86cd799439011',
      };
      const profile = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: 'new-pic.jpg',
      };

      usersService.findByEmail
        .mockResolvedValueOnce(userWithOldPic)
        .mockResolvedValueOnce(userWithNewPic);
      usersService.update.mockResolvedValue(userWithNewPic);

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'registered', user: userWithNewPic });
      expect(usersService.update).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { profilePicture: 'new-pic.jpg' },
      );
    });

    it('should return registered when user is active and profile picture unchanged', async () => {
      const profile = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: 'https://example.com/pic.jpg',
      };
      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateGoogleUser(profile);

      expect(result).toEqual({ status: 'registered', user: mockUser });
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
      );
      expect(usersService.update).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { profilePicture: 'https://example.com/pic.jpg' },
      );
    });

    it('should normalize email to lowercase', async () => {
      const profile = {
        email: 'John.Doe@Example.COM',
        firstName: 'John',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(mockUser);

      await service.validateGoogleUser(profile);

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
      );
    });

    it('should trim whitespace from email', async () => {
      const profile = {
        email: '  john.doe@example.com  ',
        firstName: 'John',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(mockUser);

      await service.validateGoogleUser(profile);

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
      );
    });
  });

  describe('login', () => {
    it('should return access token and user', async () => {
      const token = 'jwt-token';
      jwtService.sign.mockReturnValue(token);

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: token,
        user: mockUser,
        userId: '507f1f77bcf86cd799439011',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload);
    });

    it('should use user.id when _id is not available', async () => {
      const userWithoutId = { ...mockUser };
      userWithoutId._id = undefined;
      userWithoutId.id = 'custom-id';
      const token = 'jwt-token';
      jwtService.sign.mockReturnValue(token);

      await service.login(userWithoutId);

      expect(jwtService.sign).toHaveBeenCalledWith({
        email: userWithoutId.email,
        sub: 'custom-id',
        role: userWithoutId.role,
        status: userWithoutId.status,
      });
    });

    it('should include all required fields in JWT payload', async () => {
      jwtService.sign.mockReturnValue('jwt-token');

      await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          sub: mockUser._id || mockUser.id,
          role: mockUser.role,
          status: mockUser.status,
        }),
      );
    });
  });
});
