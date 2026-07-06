import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role, Status } from '../users/user.schema';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

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

  const mockToken = 'jwt-token-12345';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            validateGoogleUser: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('googleLogin', () => {
    it('should be defined', () => {
      expect(controller.googleLogin).toBeDefined();
    });
  });

  describe('googleLoginCallback', () => {
    it('should redirect to signin with account_not_registered when user not found', async () => {
      const mockReq = {
        user: false,
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result).toEqual({
        url: 'http://localhost:4200/signin?message=account_not_registered',
      });
    });

    it('should redirect to auth callback with token and user data when user is registered', async () => {
      const mockReq = {
        user: {
          ...mockUser,
          token: mockToken,
        },
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result).toEqual({
        url: `http://localhost:4200/auth/callback?token=${mockToken}&status=${mockUser.status}&role=${mockUser.role}&profilePicture=${encodeURIComponent(mockUser.profilePicture || '')}&nom=${encodeURIComponent(mockUser.nom || '')}&prenom=${encodeURIComponent(mockUser.prenom || '')}&email=${encodeURIComponent(mockUser.email || '')}`,
      });
    });

    it('should handle missing profile picture gracefully', async () => {
      const mockReq = {
        user: {
          ...mockUser,
          profilePicture: null,
          token: mockToken,
        },
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result.url).toContain('profilePicture=');
      expect(result.url).not.toContain('profilePicture=null');
    });

    it('should handle missing nom gracefully', async () => {
      const mockReq = {
        user: {
          ...mockUser,
          nom: null,
          token: mockToken,
        },
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result.url).toContain('nom=');
      expect(result.url).not.toContain('nom=null');
    });

    it('should handle missing prenom gracefully', async () => {
      const mockReq = {
        user: {
          ...mockUser,
          prenom: null,
          token: mockToken,
        },
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result.url).toContain('prenom=');
      expect(result.url).not.toContain('prenom=null');
    });

    it('should handle missing email gracefully', async () => {
      const mockReq = {
        user: {
          ...mockUser,
          email: null,
          token: mockToken,
        },
      };

      const result = await controller.googleLoginCallback(mockReq as any);

      expect(result.url).toContain('email=');
      expect(result.url).not.toContain('email=null');
    });
  });

  describe('googleAuthRedirect', () => {
    it('should return user data', async () => {
      const mockReq = {
        user: mockUser,
      };

      const result = await controller.googleAuthRedirect(mockReq as any);

      expect(result).toEqual(mockUser);
    });
  });
});
