/// <reference types="jest" />
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Role } from '../users/user.schema';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: Partial<DashboardService>;

  beforeEach(() => {
    service = {
      getStats: jest.fn(),
    };
    controller = new DashboardController(service as DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('calls getStats with userId and role from req.user', async () => {
      const mockStats = { totalUsers: 10, totalDevices: 5 };
      (service.getStats as jest.Mock).mockResolvedValue(mockStats);

      const req = {
        user: {
          userId: 'user-123',
          role: Role.ADMIN,
        },
      };

      const result = await controller.getStats(req);

      expect(service.getStats).toHaveBeenCalledWith('user-123', Role.ADMIN);
      expect(result).toEqual(mockStats);
    });

    it('falls back to req.user.sub when userId is missing', async () => {
      const mockStats = { totalUsers: 5 };
      (service.getStats as jest.Mock).mockResolvedValue(mockStats);

      const req = {
        user: {
          sub: 'user-sub-456',
          role: Role.IT,
        },
      };

      const result = await controller.getStats(req);

      expect(service.getStats).toHaveBeenCalledWith('user-sub-456', Role.IT);
      expect(result).toEqual(mockStats);
    });

    it('handles missing user gracefully', async () => {
      const mockStats = {};
      (service.getStats as jest.Mock).mockResolvedValue(mockStats);

      const req = {
        user: undefined,
      };

      const result = await controller.getStats(req);

      expect(service.getStats).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockStats);
    });
  });
});
