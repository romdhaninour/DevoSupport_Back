import { Test, TestingModule } from '@nestjs/testing';
import { ChatsService } from './chats.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '../users/user.schema';

describe('ChatsService', () => {
  let service: ChatsService;
  let chatModel: Model<ChatDocument>;

  const mockChat = {
    _id: '507f1f77bcf86cd799439011',
    sender: '507f1f77bcf86cd799439012',
    receiver: '507f1f77bcf86cd799439013',
    message: 'Test message',
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockChatInstance = (data: any = {}) => {
    const instance = { ...mockChat, ...data };
    instance.save = jest.fn().mockImplementation(function () { return Promise.resolve(this); });
    return instance;
  };

  const mockChatModel = jest.fn().mockImplementation((data: any) => createMockChatInstance(data));
  mockChatModel.find = jest.fn();
  mockChatModel.findById = jest.fn();
  mockChatModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

  jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsService,
        {
          provide: getModelToken(Chat.name),
          useValue: mockChatModel,
        },
      ],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
    chatModel = module.get<Model<ChatDocument>>(getModelToken(Chat.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMessage', () => {
    beforeEach(() => {
      mockChatModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          sender: 'senderId',
          receiver: 'receiverId',
          message: 'Test message',
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      });
    });

    it('should create a new message with valid roles', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.IT, Role.CONSULTANT);
      
      expect(mockChatModel).toHaveBeenCalledWith({
        sender: 'senderId',
        receiver: 'receiverId',
        message: 'Test message',
        read: false,
      });
      expect(result).toBeDefined();
      expect(result.sender).toBe('senderId');
      expect(result.receiver).toBe('receiverId');
      expect(result.message).toBe('Test message');
    });

    it('should throw ForbiddenException for disallowed conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.ADMIN, Role.CONSULTANT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow IT to ADMIN conversation', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.IT, Role.ADMIN);
      
      expect(mockChatModel).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should allow Consultant to IT conversation', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.CONSULTANT, Role.IT);
      
      expect(mockChatModel).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for Consultant to ADMIN conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.CONSULTANT, Role.ADMIN)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for Consultant to Consultant conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.CONSULTANT, Role.CONSULTANT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for ADMIN to Consultant conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.ADMIN, Role.CONSULTANT)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getConversation', () => {
    it('should get conversation between two users', async () => {
      const messages = [mockChat];
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(messages),
      });

      const result = await service.getConversation('user1', 'user2', 50);
      
      expect(mockChatModel.find).toHaveBeenCalledWith({
        $or: [
          { sender: 'user1', receiver: 'user2' },
          { sender: 'user2', receiver: 'user1' },
        ],
      });
      expect(result).toEqual(messages);
    });
  });

  describe('getUnreadMessages', () => {
    it('should get unread messages for a user', async () => {
      const messages = [mockChat];
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(messages),
      });

      const result = await service.getUnreadMessages('userId');
      
      expect(mockChatModel.find).toHaveBeenCalledWith({
        receiver: 'userId',
        read: false,
      });
      expect(result).toEqual(messages);
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', async () => {
      const messageInstance = createMockChatInstance({ receiver: 'userId' });
      mockChatModel.findById.mockReturnValue(messageInstance);

      const result = await service.markAsRead('messageId', 'userId');
      
      expect(mockChatModel.findById).toHaveBeenCalledWith('messageId');
      expect(messageInstance.read).toBe(true);
      expect(messageInstance.save).toHaveBeenCalled();
      expect(result).toEqual(messageInstance);
    });

    it('should throw NotFoundException if message not found', async () => {
      mockChatModel.findById.mockReturnValue(null);

      await expect(service.markAsRead('messageId', 'userId'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not receiver', async () => {
      const messageInstance = createMockChatInstance({ receiver: 'otherUserId' });
      mockChatModel.findById.mockReturnValue(messageInstance);

      await expect(service.markAsRead('messageId', 'userId'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages in conversation as read', async () => {
      await service.markConversationAsRead('senderId', 'receiverId');
      
      expect(mockChatModel.updateMany).toHaveBeenCalledWith(
        { sender: 'senderId', receiver: 'receiverId', read: false },
        { read: true },
      );
    });
  });

  describe('getConversationsForUser', () => {
    it('should get conversations for consultant user (only with IT)', async () => {
      const mockChatWithIT = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'IT' },
        receiver: { _id: 'userId', role: 'CONSULTANT' }
      };
      const mockChatWithAdmin = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'ADMIN' },
        receiver: { _id: 'userId', role: 'CONSULTANT' }
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatWithIT, mockChatWithAdmin]),
      });

      const result = await service.getConversationsForUser('userId', Role.CONSULTANT);
      
      expect(mockChatModel.find).toHaveBeenCalled();
      expect(result.length).toBe(1);
    });

    it('should get conversations for IT user (with Consultants and ADMIN)', async () => {
      const mockChatWithConsultant = { 
        ...mockChat, 
        sender: { _id: 'consultantSenderId', role: 'CONSULTANT' },
        receiver: { _id: 'userId', role: 'IT' }
      };
      const mockChatWithAdmin = { 
        ...mockChat, 
        sender: { _id: 'adminSenderId', role: 'ADMIN' },
        receiver: { _id: 'userId', role: 'IT' }
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatWithConsultant, mockChatWithAdmin]),
      });

      const result = await service.getConversationsForUser('userId', Role.IT);
      
      expect(mockChatModel.find).toHaveBeenCalled();
      expect(result.length).toBe(2);
    });

    it('should get conversations for ADMIN user (only with IT)', async () => {
      const mockChatWithIT = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'IT' },
        receiver: { _id: 'userId', role: 'ADMIN' }
      };
      const mockChatWithConsultant = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'CONSULTANT' },
        receiver: { _id: 'userId', role: 'ADMIN' }
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatWithIT, mockChatWithConsultant]),
      });

      const result = await service.getConversationsForUser('userId', Role.ADMIN);
      
      expect(mockChatModel.find).toHaveBeenCalled();
      expect(result.length).toBe(1);
    });

    it('should calculate unread count correctly', async () => {
      const mockUnreadChat = { 
        ...mockChat, 
        sender: { _id: 'partnerId', role: 'IT' },
        receiver: { _id: 'userId', role: 'CONSULTANT' },
        read: false
      };
      const mockReadChat = { 
        ...mockChat, 
        sender: { _id: 'partnerId', role: 'IT' },
        receiver: { _id: 'userId', role: 'CONSULTANT' },
        read: true
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockUnreadChat, mockReadChat]),
      });

      const result = await service.getConversationsForUser('userId', Role.CONSULTANT);
      
      expect(result.length).toBe(1);
      expect(result[0].unreadCount).toBe(1);
    });

    it('should handle conversations where user is the sender', async () => {
      const mockChatUserSender = { 
        ...mockChat, 
        sender: { _id: 'userId', role: 'CONSULTANT' },
        receiver: { _id: 'partnerId', role: 'IT' },
        read: false
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatUserSender]),
      });

      const result = await service.getConversationsForUser('userId', Role.CONSULTANT);
      
      expect(result.length).toBe(1);
      expect(result[0].partner._id).toBe('partnerId');
    });

    it('should sort conversations by latest message date', async () => {
      const olderDate = new Date('2026-01-01');
      const newerDate = new Date('2026-06-01');
      const mockChatOlder = { 
        ...mockChat, 
        createdAt: olderDate,
        sender: { _id: 'partner1', role: 'IT' },
        receiver: { _id: 'userId', role: 'CONSULTANT' },
      };
      const mockChatNewer = { 
        ...mockChat, 
        createdAt: newerDate,
        sender: { _id: 'partner2', role: 'IT' },
        receiver: { _id: 'userId', role: 'CONSULTANT' },
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatOlder, mockChatNewer]),
      });

      const result = await service.getConversationsForUser('userId', Role.CONSULTANT);
      
      expect(result.length).toBe(2);
      expect(new Date(result[0].lastMessage.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result[1].lastMessage.createdAt).getTime(),
      );
    });
  });

  describe('isConversationAllowed', () => {
    it('should allow IT to chat with Consultant', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.IT, 'CONSULTANT');
      expect(result).toBe(true);
    });

    it('should allow IT to chat with ADMIN', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.IT, 'ADMIN');
      expect(result).toBe(true);
    });

    it('should allow ADMIN to chat with IT', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.ADMIN, 'IT');
      expect(result).toBe(true);
    });

    it('should not allow ADMIN to chat with Consultant', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.ADMIN, 'CONSULTANT');
      expect(result).toBe(false);
    });

    it('should not allow Consultant to chat with ADMIN', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.CONSULTANT, 'ADMIN');
      expect(result).toBe(false);
    });

    it('should not allow Consultant to chat with Consultant', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.CONSULTANT, 'CONSULTANT');
      expect(result).toBe(false);
    });

    it('should allow Consultant to chat with IT', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed(Role.CONSULTANT, 'IT');
      expect(result).toBe(true);
    });

    it('should return false for unknown role', () => {
      const serviceInstance = new ChatsService(mockChatModel as any);
      const result = (serviceInstance as any).isConversationAllowed('UNKNOWN', 'IT');
      expect(result).toBe(false);
    });
  });
});
