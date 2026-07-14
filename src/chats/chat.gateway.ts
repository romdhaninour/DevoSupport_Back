import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly chatsService: ChatsService,
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
      
      console.log(`User ${userId} connected`);
      
      // Join user's personal room
      client.join(`user:${userId}`);
      
      // Emit unread messages count
      const unreadMessages = await this.chatsService.getUnreadMessages(userId);
      client.emit('unread_count', unreadMessages.length);
      
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { receiverId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;
    if (!senderId) {
      return { error: 'User not authenticated' };
    }

    try {
      // Get sender and receiver roles for validation
      const sender = await this.usersService.findOne(senderId);
      const receiver = await this.usersService.findOne(data.receiverId);
      
      if (!sender || !receiver) {
        return { error: 'User not found' };
      }

      const chatMessage = await this.chatsService.createMessage(
        senderId,
        data.receiverId,
        data.message,
        sender.role,
        receiver.role,
      );

      // Send to receiver if online
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(`user:${data.receiverId}`).emit('new_message', chatMessage);
      }

      // Send confirmation to sender
      client.emit('message_sent', chatMessage);

      return { success: true, message: chatMessage };
    } catch (error) {
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      const updatedMessage = await this.chatsService.markAsRead(data.messageId, userId);
      
      // Notify sender that message was read
      if (updatedMessage.sender) {
        const senderId = updatedMessage.sender.toString();
        this.server.to(`user:${senderId}`).emit('message_read', {
          messageId: data.messageId,
        });
      }

      return { success: true };
    } catch (error) {
      return { error: 'Failed to mark as read' };
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const currentUserId = client.data.userId;
    if (!currentUserId) {
      return { error: 'User not authenticated' };
    }

    // Mark conversation as read
    await this.chatsService.markConversationAsRead(data.userId, currentUserId);
    
    // Notify the other user
    const otherUserSocketId = this.connectedUsers.get(data.userId);
    if (otherUserSocketId) {
      this.server.to(`user:${data.userId}`).emit('conversation_read', {
        by: currentUserId,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { receiverId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;
    if (!senderId) {
      return;
    }

    // Send typing status to receiver
    this.server.to(`user:${data.receiverId}`).emit('user_typing', {
      userId: senderId,
      isTyping: data.isTyping,
    });
  }
}
