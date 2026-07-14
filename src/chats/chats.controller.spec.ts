import { Test, TestingModule } from '@nestjs/testing';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Chat, ChatDocument } from './chat.schema';

describe('ChatsController', () => {
  let controller: ChatsController;
  let service: ChatsService;

  const mockChat = {
    _id: '507f1f77bcf86cd799439011',
    sender: {
      _id: '507f1f77bcf86cd799439012',
      nom: 'Doe',
      prenom: 'John',
      email: 'john.doe@example.com',
    },
    receiver: {
      _id: '507f1f77bcf86cd799439013',
      nom: 'Smith',
      prenom: 'Jane',
      email: 'jane.smith@example.com',
    },
    message: 'Test message',
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = {
    user: {
      userId: '507f1f77bcf86cd799439012',
      sub: '507f1f77bcf86cd799439012',
      role: 'ADMIN',
    },
  };

  const mockChatsService = {
    createMessage: jest.fn(),
    getConversationsForUser: jest.fn(),
    getConversation: jest.fn(),
    getUnreadMessages: jest.fn(),
    markAsRead: jest.fn(),
    markConversationAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [
        {
          provide: ChatsService,
          useValue: mockChatsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatsController>(ChatsController);
    service = module.get<ChatsService>(ChatsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      mockChatsService.createMessage.mockResolvedValue(mockChat);
      
      const result = await controller.sendMessage(mockReq, {
        receiverId: '507f1f77bcf86cd799439013',
        message: 'Hello',
      });
      
      expect(service.createMessage).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013',
        'Hello'
      );
      expect(result).toEqual(mockChat);
    });

    it('should use sub as userId if userId not present', async () => {
      const reqWithoutUserId = {
        user: {
          sub: '507f1f77bcf86cd799439012',
          role: 'ADMIN',
        },
      };
      mockChatsService.createMessage.mockResolvedValue(mockChat);
      
      await controller.sendMessage(reqWithoutUserId, {
        receiverId: '507f1f77bcf86cd799439013',
        message: 'Hello',
      });
      
      expect(service.createMessage).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013',
        'Hello'
      );
    });
  });

  describe('getConversations', () => {
    it('should get conversations for user', async () => {
      const conversations = [mockChat];
      mockChatsService.getConversationsForUser.mockResolvedValue(conversations);
      
      const result = await controller.getConversations(mockReq);
      
      expect(service.getConversationsForUser).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        'ADMIN'
      );
      expect(result).toEqual(conversations);
    });
  });

  describe('getConversation', () => {
    it('should get conversation with specific user', async () => {
      const messages = [mockChat];
      mockChatsService.getConversation.mockResolvedValue(messages);
      
      const result = await controller.getConversation('507f1f77bcf86cd799439013', mockReq);
      
      expect(service.getConversation).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013'
      );
      expect(result).toEqual(messages);
    });
  });

  describe('getUnreadMessages', () => {
    it('should get unread messages', async () => {
      const messages = [mockChat];
      mockChatsService.getUnreadMessages.mockResolvedValue(messages);
      
      const result = await controller.getUnreadMessages(mockReq);
      
      expect(service.getUnreadMessages).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(result).toEqual(messages);
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      mockChatsService.markAsRead.mockResolvedValue(mockChat);
      
      const result = await controller.markAsRead('messageId', mockReq);
      
      expect(service.markAsRead).toHaveBeenCalledWith('messageId', '507f1f77bcf86cd799439012');
      expect(result).toEqual(mockChat);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark conversation as read', async () => {
      mockChatsService.markConversationAsRead.mockResolvedValue(undefined);
      
      const result = await controller.markConversationAsRead('senderId', mockReq);
      
      expect(service.markConversationAsRead).toHaveBeenCalledWith(
        'senderId',
        '507f1f77bcf86cd799439012'
      );
      expect(result).toBeUndefined();
    });
  });
});
