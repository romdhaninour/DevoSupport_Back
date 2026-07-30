/// <reference types="jest" />
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Role } from '../users/user.schema';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: Partial<NotificationsService>;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findUnread: jest.fn(),
      getUnreadCount: jest.fn(),
      findOne: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      remove: jest.fn(),
    };
    controller = new NotificationsController(service as NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all notifications for the user role', async () => {
      const mockNotifications = [
        { _id: '1', message: 'Test', read: false },
        { _id: '2', message: 'Test 2', read: true },
      ];
      (service.findAll as jest.Mock).mockResolvedValue(mockNotifications);

      const req = { user: { role: Role.ADMIN } };
      const result = await controller.findAll(req);

      expect(service.findAll).toHaveBeenCalledWith(Role.ADMIN);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('findUnread', () => {
    it('returns unread notifications for the user role', async () => {
      const mockNotifications = [{ _id: '1', message: 'Unread', read: false }];
      (service.findUnread as jest.Mock).mockResolvedValue(mockNotifications);

      const req = { user: { role: Role.IT } };
      const result = await controller.findUnread(req);

      expect(service.findUnread).toHaveBeenCalledWith(Role.IT);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count for the user role', async () => {
      (service.getUnreadCount as jest.Mock).mockResolvedValue(5);

      const req = { user: { role: Role.ADMIN } };
      const result = await controller.getUnreadCount(req);

      expect(service.getUnreadCount).toHaveBeenCalledWith(Role.ADMIN);
      expect(result).toBe(5);
    });
  });

  describe('findOne', () => {
    it('returns a notification by id', async () => {
      const mockNotification = { _id: 'notif-1', message: 'Test' };
      (service.findOne as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.findOne('notif-1');

      expect(service.findOne).toHaveBeenCalledWith('notif-1');
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      const mockNotification = { _id: 'notif-1', read: true };
      (service.markAsRead as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.markAsRead('notif-1');

      expect(service.markAsRead).toHaveBeenCalledWith('notif-1');
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read for the user role', async () => {
      const mockResult = { modifiedCount: 3 };
      (service.markAllAsRead as jest.Mock).mockResolvedValue(mockResult);

      const req = { user: { role: Role.ADMIN } };
      const result = await controller.markAllAsRead(req);

      expect(service.markAllAsRead).toHaveBeenCalledWith(Role.ADMIN);
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('deletes a notification', async () => {
      const mockNotification = { _id: 'notif-1', message: 'Deleted' };
      (service.remove as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.remove('notif-1');

      expect(service.remove).toHaveBeenCalledWith('notif-1');
      expect(result).toEqual(mockNotification);
    });
  });
});
