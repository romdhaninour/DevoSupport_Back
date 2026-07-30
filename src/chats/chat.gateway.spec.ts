import { ChatGateway } from './chat.gateway';
import { ChatsService } from './chats.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Role } from '../users/user.schema';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatsService: Partial<ChatsService>;
  let jwtService: Partial<JwtService>;
  let usersService: Partial<UsersService>;

  const mockSocket: any = {
    id: 'socket-1',
    handshake: { auth: {} },
    data: {},
    emit: jest.fn(),
    join: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockServer: any = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    chatsService = {
      getUnreadMessages: jest.fn().mockResolvedValue([{ _id: 'm1' }, { _id: 'm2' }]),
      createMessage: jest.fn().mockResolvedValue({ _id: 'msg1', sender: 'user1', receiver: 'user2', message: 'Hello' }),
      markAsRead: jest.fn().mockResolvedValue({ _id: 'msg1', sender: 'sender1', receiver: 'receiver1' }),
      markConversationAsRead: jest.fn().mockResolvedValue(undefined),
      addReaction: jest.fn().mockResolvedValue({ _id: 'msg1', sender: 'sender1', receiver: 'receiver1', reactions: [] }),
      getMessageById: jest.fn().mockResolvedValue({ _id: 'msg1', reactions: [{ emoji: '👍', userId: 'user1' }] }),
    };
    jwtService = {
      verify: jest.fn().mockReturnValue({ userId: 'user1', sub: 'user1' }),
    };
    usersService = {
      findOne: jest.fn().mockResolvedValue({ _id: 'user1', role: Role.IT }),
    };

    gateway = new ChatGateway(chatsService as ChatsService, jwtService as JwtService, usersService as UsersService);
    gateway.server = mockServer as any;
    (gateway as any).connectedUsers = new Map();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should disconnect if no token provided', async () => {
      mockSocket.handshake.auth = {};

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should authenticate and setup user on valid token', async () => {
      mockSocket.handshake.auth = { token: 'valid-token' };

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.data.userId).toBe('user1');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user1');
      expect(chatsService.getUnreadMessages).toHaveBeenCalledWith('user1');
      expect(mockSocket.emit).toHaveBeenCalledWith('unread_count', 2);
    });

    it('should disconnect on JWT verification error', async () => {
      mockSocket.handshake.auth = { token: 'invalid-token' };
      (jwtService.verify as jest.Mock).mockImplementation(() => { throw new Error('JWT Error'); });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should use sub as userId if userId not present', async () => {
      mockSocket.handshake.auth = { token: 'valid-token' };
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user1' });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.data.userId).toBe('user1');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from connected users map', () => {
      const map = (gateway as any).connectedUsers;
      map.set('user1', 'socket-1');

      gateway.handleDisconnect(mockSocket);

      expect(map.has('user1')).toBe(false);
    });

    it('should not fail if user has no userId', () => {
      mockSocket.data = {};

      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  describe('handleMessage (send_message)', () => {
    it('should return error if user not authenticated', async () => {
      mockSocket.data = {};

      const result = await gateway.handleMessage({ receiverId: 'user2', message: 'Hello' }, mockSocket);

      expect(result).toEqual({ error: 'User not authenticated' });
    });

    it('should return error if sender not found', async () => {
      mockSocket.data = { userId: 'user1' };
      (usersService.findOne as jest.Mock).mockResolvedValue(null);

      const result = await gateway.handleMessage({ receiverId: 'user2', message: 'Hello' }, mockSocket);

      expect(result).toEqual({ error: 'User not found' });
    });

    it('should return error if receiver not found', async () => {
      mockSocket.data = { userId: 'user1' };
      (usersService.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: 'user1', role: Role.IT })
        .mockResolvedValueOnce(null);

      const result = await gateway.handleMessage({ receiverId: 'user2', message: 'Hello' }, mockSocket);

      expect(result).toEqual({ error: 'User not found' });
    });

    it('should send message and notify receiver', async () => {
      mockSocket.data = { userId: 'user1' };
      (usersService.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: 'user1', role: Role.IT })
        .mockResolvedValueOnce({ _id: 'user2', role: Role.CONSULTANT });
      (gateway as any).connectedUsers.set('user2', 'socket-2');

      const result = await gateway.handleMessage({ receiverId: 'user2', message: 'Hello' }, mockSocket);

      expect(chatsService.createMessage).toHaveBeenCalledWith('user1', 'user2', 'Hello', Role.IT, Role.CONSULTANT, undefined);
      expect(mockServer.to).toHaveBeenCalledWith('user:user2');
      expect(mockSocket.emit).toHaveBeenCalledWith('message_sent', { _id: 'msg1', sender: 'user1', receiver: 'user2', message: 'Hello' });
      expect(result).toEqual({ success: true, message: { _id: 'msg1', sender: 'user1', receiver: 'user2', message: 'Hello' } });
    });

    it('should handle error during message creation', async () => {
      mockSocket.data = { userId: 'user1' };
      (chatsService.createMessage as jest.Mock).mockRejectedValue(new Error('Creation failed'));

      const result = await gateway.handleMessage({ receiverId: 'user2', message: 'Hello' }, mockSocket);

      expect(result).toEqual({ error: 'Failed to send message' });
    });

    it('should send message with imageUrl when provided', async () => {
      mockSocket.data = { userId: 'user1' };
      (usersService.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: 'user1', role: Role.IT })
        .mockResolvedValueOnce({ _id: 'user2', role: Role.CONSULTANT });

      const result = await gateway.handleMessage(
        { receiverId: 'user2', message: 'Check this', imageUrl: 'http://example.com/img.jpg' },
        mockSocket,
      );

      expect(chatsService.createMessage).toHaveBeenCalledWith('user1', 'user2', 'Check this', Role.IT, Role.CONSULTANT, 'http://example.com/img.jpg');
      expect(result).toEqual({ success: true, message: expect.any(Object) });
    });

    it('should handle message when receiver is offline', async () => {
      mockSocket.data = { userId: 'user1' };
      (usersService.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: 'user1', role: Role.IT })
        .mockResolvedValueOnce({ _id: 'user2', role: Role.CONSULTANT });

      const result = await gateway.handleMessage(
        { receiverId: 'user2', message: 'Hello offline user' },
        mockSocket,
      );

      expect(chatsService.createMessage).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('message_sent', expect.any(Object));
      expect(result).toEqual({ success: true, message: expect.any(Object) });
    });
  });

  describe('handleMarkAsRead (mark_as_read)', () => {
    it('should return error if user not authenticated', async () => {
      mockSocket.data = {};

      const result = await gateway.handleMarkAsRead({ messageId: 'msg1' }, mockSocket);

      expect(result).toEqual({ error: 'User not authenticated' });
    });

    it('should mark message as read and notify sender', async () => {
      mockSocket.data = { userId: 'user1' };

      const result = await gateway.handleMarkAsRead({ messageId: 'msg1' }, mockSocket);

      expect(chatsService.markAsRead).toHaveBeenCalledWith('msg1', 'user1');
      expect(mockServer.to).toHaveBeenCalledWith('user:sender1');
      expect(result).toEqual({ success: true });
    });

    it('should handle error gracefully', async () => {
      mockSocket.data = { userId: 'user1' };
      (chatsService.markAsRead as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await gateway.handleMarkAsRead({ messageId: 'msg1' }, mockSocket);

      expect(result).toEqual({ error: 'Failed to mark as read' });
    });

    it('should skip sender notification if no sender', async () => {
      mockSocket.data = { userId: 'user1' };
      (chatsService.markAsRead as jest.Mock).mockResolvedValue({ _id: 'msg1', sender: null });

      const result = await gateway.handleMarkAsRead({ messageId: 'msg1' }, mockSocket);

      expect(result).toEqual({ success: true });
    });
  });

  describe('handleJoinConversation (join_conversation)', () => {
    it('should return error if user not authenticated', async () => {
      mockSocket.data = {};

      const result = await gateway.handleJoinConversation({ userId: 'user2' }, mockSocket);

      expect(result).toEqual({ error: 'User not authenticated' });
    });

    it('should mark conversation as read and notify other user', async () => {
      mockSocket.data = { userId: 'user1' };
      (gateway as any).connectedUsers.set('user2', 'socket-2');

      const result = await gateway.handleJoinConversation({ userId: 'user2' }, mockSocket);

      expect(chatsService.markConversationAsRead).toHaveBeenCalledWith('user2', 'user1');
      expect(mockServer.to).toHaveBeenCalledWith('user:user2');
      expect(result).toEqual({ success: true });
    });

    it('should not notify if other user is offline', async () => {
      mockSocket.data = { userId: 'user1' };

      const result = await gateway.handleJoinConversation({ userId: 'user2' }, mockSocket);

      expect(chatsService.markConversationAsRead).toHaveBeenCalledWith('user2', 'user1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleTyping (typing)', () => {
    it('should return early if user not authenticated', async () => {
      mockSocket.data = {};

      const result = await gateway.handleTyping({ receiverId: 'user2', isTyping: true }, mockSocket);

      expect(result).toBeUndefined();
    });

    it('should send typing status to receiver', async () => {
      mockSocket.data = { userId: 'user1' };

      await gateway.handleTyping({ receiverId: 'user2', isTyping: true }, mockSocket);

      expect(mockServer.to).toHaveBeenCalledWith('user:user2');
      expect(mockServer.emit).toHaveBeenCalledWith('user_typing', { userId: 'user1', isTyping: true });
    });
  });

  describe('handleToggleReaction (toggle_reaction)', () => {
    it('should return error if user not authenticated', async () => {
      mockSocket.data = {};

      const result = await gateway.handleToggleReaction({ messageId: 'msg1', emoji: '👍' }, mockSocket);

      expect(result).toEqual({ error: 'User not authenticated' });
    });

    it('should toggle reaction and notify both users', async () => {
      mockSocket.data = { userId: 'user1' };

      const result = await gateway.handleToggleReaction({ messageId: 'msg1', emoji: '👍' }, mockSocket);

      expect(chatsService.addReaction).toHaveBeenCalledWith('msg1', 'user1', '👍');
      expect(mockServer.to).toHaveBeenCalledWith('user:sender1');
      expect(mockServer.to).toHaveBeenCalledWith('user:receiver1');
      expect(result).toEqual({ success: true });
    });

    it('should handle error gracefully', async () => {
      mockSocket.data = { userId: 'user1' };
      (chatsService.addReaction as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await gateway.handleToggleReaction({ messageId: 'msg1', emoji: '👍' }, mockSocket);

      expect(result).toEqual({ error: 'Failed to toggle reaction' });
    });
  });
});
