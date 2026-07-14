import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Notification } from './notification.schema';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
  namespace: '/notifications',
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.userId || decoded.sub;

      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;
      client.data.role = decoded.role;

      client.join(`role:${decoded.role}`);
      client.join(`user:${userId}`);

      console.log(`Notification user ${userId} connected (role: ${decoded.role})`);
    } catch (error) {
      console.error('Notification connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`Notification user ${userId} disconnected`);
    }
  }

  broadcastNotification(notification: Notification) {
    if (!this.server) return;

    const recipientRoles = notification.recipientRoles || ['ADMIN', 'IT'];
    recipientRoles.forEach(role => {
      this.server.to(`role:${role}`).emit('new_notification', notification);
    });
  }
}
