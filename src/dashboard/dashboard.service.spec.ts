/// <reference types="jest" />
import { DashboardService } from './dashboard.service';
import { Role, Status } from '../users/user.schema';
import { TicketStatus } from '../tickets/schemas/ticket.schema';
import { Types } from 'mongoose';

describe('DashboardService', () => {
  let service: DashboardService;
  let userModel: any;
  let deviceModel: any;
  let ticketModel: any;

  beforeEach(() => {
    userModel = {
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    deviceModel = {
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    ticketModel = {
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      find: jest.fn(),
    };
    service = new DashboardService(userModel, deviceModel, ticketModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('delegates to getConsultantStats when role is CONSULTANT', async () => {
      const mockObjectId = new Types.ObjectId('507f1f77bcf86cd799439011');
      deviceModel.countDocuments.mockResolvedValue(2);
      ticketModel.countDocuments
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ title: 'Ticket 1' }]),
      });

      const result = await service.getStats('507f1f77bcf86cd799439011', Role.CONSULTANT);

      expect(result).toHaveProperty('myDevices');
      expect(result).toHaveProperty('myTickets');
      expect(result).toHaveProperty('myOpenTickets');
      expect(result).toHaveProperty('myInProgressTickets');
      expect(result).toHaveProperty('myRecentTickets');
      expect(result.myDevices).toBe(2);
      expect(result.myTickets).toBe(5);
      expect(result.myOpenTickets).toBe(3);
      expect(result.myInProgressTickets).toBe(1);
      expect(ticketModel.find).toHaveBeenCalledWith({ createdBy: mockObjectId });
    });

    it('delegates to getAdminITStats when role is ADMIN', async () => {
      userModel.countDocuments.mockResolvedValue(10);
      deviceModel.countDocuments.mockResolvedValue(20);
      ticketModel.countDocuments.mockResolvedValue(30);
      userModel.aggregate.mockResolvedValue([
        { _id: Role.ADMIN, count: 3 },
        { _id: Role.IT, count: 2 },
      ]);
      deviceModel.aggregate
        .mockResolvedValueOnce([{ _id: 'available', count: 15 }])
        .mockResolvedValueOnce([{ _id: 'Laptop', count: 10 }]);
      ticketModel.aggregate
        .mockResolvedValueOnce([{ _id: 'open', count: 10 }])
        .mockResolvedValueOnce([{ _id: 'high', count: 5 }])
        .mockResolvedValueOnce([{ _id: 'damaged', count: 3 }]);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getStats('admin-1', Role.ADMIN);

      expect(result).toHaveProperty('totalUsers', 10);
      expect(result).toHaveProperty('totalDevices', 20);
      expect(result).toHaveProperty('totalTickets', 30);
      expect(result).toHaveProperty('usersByRole');
      expect(result).toHaveProperty('devicesByStatus');
      expect(result).toHaveProperty('devicesByType');
      expect(result).toHaveProperty('ticketsByStatus');
      expect(result).toHaveProperty('ticketsByPriority');
      expect(result).toHaveProperty('ticketsByIssueType');
      expect(result).toHaveProperty('recentTickets');
      expect(result.usersByRole).toEqual({ ADMIN: 3, IT: 2 });
      expect(result.devicesByStatus).toEqual({ available: 15 });
      expect(result.devicesByType).toEqual({ Laptop: 10 });
    });

    it('delegates to getAdminITStats when role is IT', async () => {
      userModel.countDocuments.mockResolvedValue(5);
      deviceModel.countDocuments.mockResolvedValue(8);
      ticketModel.countDocuments.mockResolvedValue(12);
      userModel.aggregate.mockResolvedValue([]);
      deviceModel.aggregate.mockResolvedValue([]);
      ticketModel.aggregate.mockResolvedValue([]);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getStats('it-1', Role.IT);

      expect(result).toHaveProperty('totalUsers', 5);
      expect(result).toHaveProperty('totalDevices', 8);
      expect(result).toHaveProperty('totalTickets', 12);
    });
  });

  describe('getConsultantStats (via getStats)', () => {
    it('counts assigned devices for the consultant', async () => {
      deviceModel.countDocuments.mockResolvedValue(3);
      ticketModel.countDocuments.mockResolvedValue(0);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getStats('507f1f77bcf86cd799439011', Role.CONSULTANT);

      expect(deviceModel.countDocuments).toHaveBeenCalledWith({
        assignedTo: '507f1f77bcf86cd799439011',
        status: 'assigned',
      });
      expect(result.myDevices).toBe(3);
    });

    it('counts tickets with different statuses', async () => {
      deviceModel.countDocuments.mockResolvedValue(0);
      ticketModel.countDocuments
        .mockResolvedValueOnce(10) // myTickets
        .mockResolvedValueOnce(4) // myOpenTickets
        .mockResolvedValueOnce(2); // myInProgressTickets
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ title: 'Recent' }]),
      });

      const result = await service.getStats('507f1f77bcf86cd799439011', Role.CONSULTANT);

      expect(result.myTickets).toBe(10);
      expect(result.myOpenTickets).toBe(4);
      expect(result.myInProgressTickets).toBe(2);
      expect(result.myRecentTickets).toEqual([{ title: 'Recent' }]);
    });
  });

  describe('arrayToMap (via getAdminITStats)', () => {
    it('converts aggregate results to a map', async () => {
      userModel.countDocuments.mockResolvedValue(0);
      deviceModel.countDocuments.mockResolvedValue(0);
      ticketModel.countDocuments.mockResolvedValue(0);
      userModel.aggregate.mockResolvedValue([
        { _id: Role.ADMIN, count: 5 },
        { _id: Role.IT, count: 3 },
        { _id: Role.CONSULTANT, count: 10 },
      ]);
      deviceModel.aggregate.mockResolvedValue([]);
      ticketModel.aggregate.mockResolvedValue([]);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getStats('admin-1', Role.ADMIN);

      expect(result.usersByRole).toEqual({
        ADMIN: 5,
        IT: 3,
        CONSULTANT: 10,
      });
    });

    it('handles empty aggregate results', async () => {
      userModel.countDocuments.mockResolvedValue(0);
      deviceModel.countDocuments.mockResolvedValue(0);
      ticketModel.countDocuments.mockResolvedValue(0);
      userModel.aggregate.mockResolvedValue([]);
      deviceModel.aggregate.mockResolvedValue([]);
      ticketModel.aggregate.mockResolvedValue([]);
      ticketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getStats('admin-1', Role.ADMIN);

      expect(result.usersByRole).toEqual({});
      expect(result.devicesByStatus).toEqual({});
      expect(result.ticketsByStatus).toEqual({});
    });
  });
});
