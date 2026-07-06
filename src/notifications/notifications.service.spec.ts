import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getModelToken } from '@nestjs/mongoose';
import { Notification } from './notification.schema';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationModel: jest.Mocked<Model<Notification>>;

  const mockNotification = {
    _id: '507f1f77bcf86cd799439011',
    message: 'Test notification',
    type: 'user_signup',
    read: false,
    createdAt: new Date(),
  };

  // Create a proper mock that can be used as a constructor
  const MockNotificationModel: any = function(this: any, data: any) {
    this._id = data._id || '507f1f77bcf86cd799439011';
    this.message = data.message;
    this.type = data.type;
    this.read = data.read || false;
    this.createdAt = data.createdAt || new Date();
    this.save = jest.fn().mockResolvedValue(this);
  };

  MockNotificationModel.find = jest.fn();
  MockNotificationModel.findById = jest.fn();
  MockNotificationModel.findByIdAndUpdate = jest.fn();
  MockNotificationModel.findByIdAndDelete = jest.fn();
  MockNotificationModel.updateMany = jest.fn();
  MockNotificationModel.deleteMany = jest.fn();
  MockNotificationModel.create = jest.fn();

  const mockNotificationModel = MockNotificationModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationModel = module.get(getModelToken(Notification.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      const createDto = {
        message: 'Test notification',
        type: 'user_signup',
      };

      const createdNotification = { ...mockNotification, ...createDto };
      MockNotificationModel.create.mockResolvedValue(createdNotification as any);

      const result = await service.create(createDto as any);

      expect(result).toMatchObject({
        _id: mockNotification._id,
        message: createDto.message,
        type: createDto.type,
        read: false,
      });
    });
  });

  describe('findAll', () => {
    it('should return all notifications sorted by createdAt desc', async () => {
      const notifications = [mockNotification, { ...mockNotification, _id: '2' }];
      mockNotificationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(notifications),
        }),
      } as any);

      const result = await service.findAll();

      expect(result).toEqual(notifications);
      expect(mockNotificationModel.find).toHaveBeenCalled();
    });
  });

  describe('findUnread', () => {
    it('should return unread notifications sorted by createdAt desc', async () => {
      const unreadNotifications = [mockNotification];
      mockNotificationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(unreadNotifications),
        }),
      } as any);

      const result = await service.findUnread();

      expect(result).toEqual(unreadNotifications);
      expect(mockNotificationModel.find).toHaveBeenCalledWith({ read: false });
    });
  });

  describe('findOne', () => {
    it('should return a notification by ID', async () => {
      mockNotificationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockNotification),
      } as any);

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockNotification);
      expect(mockNotificationModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockNotificationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        'Notification #507f1f77bcf86cd799439011 not found'
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const updatedNotification = { ...mockNotification, read: true };
      mockNotificationModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedNotification),
      } as any);

      const result = await service.markAsRead('507f1f77bcf86cd799439011');

      expect(result).toEqual(updatedNotification);
      expect(mockNotificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { read: true },
        { new: true }
      );
    });

    it('should throw NotFoundException if notification not found when marking as read', async () => {
      mockNotificationModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.markAsRead('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const updateResult = { modifiedCount: 5 };
      mockNotificationModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updateResult),
      } as any);

      const result = await service.markAllAsRead();

      expect(result).toEqual(updateResult);
      expect(mockNotificationModel.updateMany).toHaveBeenCalledWith({ read: false }, { read: true });
    });
  });

  describe('remove', () => {
    it('should delete a notification', async () => {
      mockNotificationModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockNotification),
      } as any);

      const result = await service.remove('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockNotification);
      expect(mockNotificationModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException if notification not found when deleting', async () => {
      mockNotificationModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearAll', () => {
    it('should delete all notifications', async () => {
      const deleteResult = { deletedCount: 10 };
      mockNotificationModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deleteResult),
      } as any);

      const result = await service.clearAll();

      expect(result).toEqual(deleteResult);
      expect(mockNotificationModel.deleteMany).toHaveBeenCalledWith({});
    });
  });
});
