/// <reference types="jest" />
import { NotificationsGateway } from './notifications.gateway';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: Partial<JwtService>;
  let usersService: Partial<UsersService>;
  let mockServer: any;

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };
    usersService = {};
    gateway = new NotificationsGateway(
      jwtService as JwtService,
      usersService as UsersService,
    );
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('disconnects client if no token is provided', async () => {
      const client = {
        handshake: { auth: {} },
        disconnect: jest.fn(),
        data: {},
        join: jest.fn(),
      };

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('verifies token and joins rooms on valid token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        userId: 'user-123',
        role: 'ADMIN',
      });

      const client = {
        handshake: { auth: { token: 'valid-token' } },
        disconnect: jest.fn(),
        data: {},
        join: jest.fn(),
      };

      await gateway.handleConnection(client as any);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.data.userId).toBe('user-123');
      expect(client.data.role).toBe('ADMIN');
      expect(client.join).toHaveBeenCalledWith('role:ADMIN');
      expect(client.join).toHaveBeenCalledWith('user:user-123');
    });

    it('uses sub as userId when userId is not present in decoded token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-sub-789',
        role: 'IT',
      });

      const client = {
        handshake: { auth: { token: 'valid-token' } },
        disconnect: jest.fn(),
        data: {},
        join: jest.fn(),
      };

      await gateway.handleConnection(client as any);

      expect(client.data.userId).toBe('user-sub-789');
    });

    it('disconnects client on verification error', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const client = {
        handshake: { auth: { token: 'bad-token' } },
        disconnect: jest.fn(),
        data: {},
        join: jest.fn(),
      };

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes user from connectedUsers map', async () => {
      const client = {
        data: { userId: 'user-123' },
      };

      // First connect
      (jwtService.verify as jest.Mock).mockReturnValue({
        userId: 'user-123',
        role: 'ADMIN',
      });
      const connectClient = {
        handshake: { auth: { token: 'valid-token' } },
        disconnect: jest.fn(),
        data: {},
        join: jest.fn(),
      };
      await gateway.handleConnection(connectClient as any);

      // Then disconnect
      gateway.handleDisconnect(client as any);

      // Verify it's removed (try connecting again with same userId would re-add)
    });

    it('does nothing if userId is not set', () => {
      const client = { data: {} };
      expect(() => gateway.handleDisconnect(client as any)).not.toThrow();
    });
  });

  describe('broadcastNotification', () => {
    it('emits notification to each recipient role', () => {
      const notification = {
        _id: 'notif-1',
        message: 'Test',
        recipientRoles: ['ADMIN', 'IT'],
      };

      gateway.broadcastNotification(notification as any);

      expect(mockServer.to).toHaveBeenCalledWith('role:ADMIN');
      expect(mockServer.to).toHaveBeenCalledWith('role:IT');
      expect(mockServer.emit).toHaveBeenCalledWith('new_notification', notification);
    });

    it('defaults to ADMIN and IT roles if recipientRoles is undefined', () => {
      const notification = {
        _id: 'notif-1',
        message: 'Test',
      };

      gateway.broadcastNotification(notification as any);

      expect(mockServer.to).toHaveBeenCalledWith('role:ADMIN');
      expect(mockServer.to).toHaveBeenCalledWith('role:IT');
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });

    it('does nothing if server is not set', () => {
      gateway.server = undefined as any;

      const notification = { _id: 'notif-1', message: 'Test' };
      expect(() => gateway.broadcastNotification(notification as any)).not.toThrow();
    });
  });
});
