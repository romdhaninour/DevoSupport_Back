import { Test, TestingModule } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from './auth.service';
import { Role, Status } from '../users/user.schema';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let authService: jest.Mocked<AuthService>;

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

  const mockProfile = {
    name: {
      givenName: 'John',
      familyName: 'Doe',
    },
    emails: [{ value: 'john.doe@example.com' }],
    photos: [{ value: 'https://example.com/pic.jpg' }],
  };

  beforeEach(async () => {
    // Set required environment variables for GoogleStrategy
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: AuthService,
          useValue: {
            validateGoogleUser: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  describe('validate', () => {
    it('should validate registered user and return user with token', async () => {
      const mockDone = jest.fn();
      authService.validateGoogleUser.mockResolvedValue({
        status: 'registered',
        user: mockUser,
      });
      authService.login.mockResolvedValue({
        access_token: 'jwt-token',
        user: mockUser,
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone as any,
      );

      expect(authService.validateGoogleUser).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: 'https://example.com/pic.jpg',
      });
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(mockDone).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          _id: mockUser._id,
          nom: mockUser.nom,
          prenom: mockUser.prenom,
          email: mockUser.email,
          role: mockUser.role,
          status: mockUser.status,
          isConsultant: mockUser.isConsultant,
          profilePicture: mockUser.profilePicture,
          token: 'jwt-token',
        }),
      );
    });

    it('should handle not registered user', async () => {
      const mockDone = jest.fn();
      authService.validateGoogleUser.mockResolvedValue({
        status: 'not_registered',
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone as any,
      );

      expect(mockDone).toHaveBeenCalledWith(null, false, {
        message: 'account_not_registered',
      });
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should handle inactive user', async () => {
      const mockDone = jest.fn();
      authService.validateGoogleUser.mockResolvedValue({
        status: 'inactive',
        user: mockUser,
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone as any,
      );

      expect(mockDone).toHaveBeenCalledWith(null, false, {
        message: 'account_inactive',
      });
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should handle missing profile picture', async () => {
      const mockDone = jest.fn();
      const profileWithoutPhoto = {
        name: mockProfile.name,
        emails: mockProfile.emails,
        photos: [],
      };
      authService.validateGoogleUser.mockResolvedValue({
        status: 'registered',
        user: mockUser,
      });
      authService.login.mockResolvedValue({
        access_token: 'jwt-token',
        user: mockUser,
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithoutPhoto,
        mockDone as any,
      );

      expect(authService.validateGoogleUser).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: null,
      });
    });
  });
});
