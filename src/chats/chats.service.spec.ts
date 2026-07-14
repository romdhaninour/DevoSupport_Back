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
    save: jest.fn().mockResolvedValue(this),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(this),
  };

  const mockChatModel = {
    new: jest.fn().mockReturnValue(mockChat),
    find: jest.fn().mockReturnValue(mockChat),
    findById: jest.fn().mockReturnValue(mockChat),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

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
    it('should create a new message with valid roles', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.IT, Role.CONSULTANT);
      
      expect(mockChatModel.new).toHaveBeenCalledWith({
        sender: 'senderId',
        receiver: 'receiverId',
        message: 'Test message',
        read: false,
      });
      expect(mockChat.save).toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should throw ForbiddenException for disallowed conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.ADMIN, Role.CONSULTANT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow IT to ADMIN conversation', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.IT, Role.ADMIN);
      
      expect(mockChatModel.new).toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should allow Consultant to IT conversation', async () => {
      const result = await service.createMessage('senderId', 'receiverId', 'Test message', Role.CONSULTANT, Role.IT);
      
      expect(mockChatModel.new).toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should throw ForbiddenException for Consultant to ADMIN conversation', async () => {
      await expect(
        service.createMessage('senderId', 'receiverId', 'Test message', Role.CONSULTANT, Role.ADMIN)
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
      const message = { ...mockChat, receiver: 'userId' };
      mockChatModel.findById.mockResolvedValue(message);

      const result = await service.markAsRead('messageId', 'userId');
      
      expect(mockChatModel.findById).toHaveBeenCalledWith('messageId');
      expect(message.read).toBe(true);
      expect(message.save).toHaveBeenCalled();
      expect(result).toEqual(message);
    });

    it('should throw NotFoundException if message not found', async () => {
      mockChatModel.findById.mockResolvedValue(null);

      await expect(service.markAsRead('messageId', 'userId'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not receiver', async () => {
      const message = { ...mockChat, receiver: 'otherUserId' };
      mockChatModel.findById.mockResolvedValue(message);

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
      expect(result.length).toBe(1); // Only IT conversation should be included
    });

    it('should get conversations for IT user (with Consultants and ADMIN)', async () => {
      const mockChatWithConsultant = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'CONSULTANT' },
        receiver: { _id: 'userId', role: 'IT' }
      };
      const mockChatWithAdmin = { 
        ...mockChat, 
        sender: { _id: 'senderId', role: 'ADMIN' },
        receiver: { _id: 'userId', role: 'IT' }
      };
      
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockChatWithConsultant, mockChatWithAdmin]),
      });

      const result = await service.getConversationsForUser('userId', Role.IT);
      
      expect(mockChatModel.find).toHaveBeenCalled();
      expect(result.length).toBe(2); // Both should be included
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
      expect(result.length).toBe(1); // Only IT conversation should be included
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
  });
});
