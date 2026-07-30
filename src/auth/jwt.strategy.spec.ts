import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { Role, Status } from '../users/user.schema';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object from JWT payload', async () => {
      const payload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
        status: Status.ACTIVE,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: '507f1f77bcf86cd799439011',
        sub: '507f1f77bcf86cd799439011',
        email: 'john.doe@example.com',
        role: Role.ADMIN,
        status: Status.ACTIVE,
      });
    });

    it('should handle payload with all fields', async () => {
      const payload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'jane@example.com',
        role: Role.IT,
        status: Status.INACTIVE,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: '507f1f77bcf86cd799439011',
        sub: '507f1f77bcf86cd799439011',
        email: 'jane@example.com',
        role: Role.IT,
        status: Status.INACTIVE,
      });
    });
  });
});
