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
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationRecipientRole } from '../notifications/notification.schema';
import { Role } from '../users/user.schema';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:4200'],
  },
  transports: ['websocket', 'polling'],
  namespace: '/chat',
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
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        console.error('Chat: No token provided in connection');
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.userId || decoded.sub;
      
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;
      
      console.log(`Chat: User ${userId} connected, socket ID: ${client.id}`);
      
      // Join user's personal room
      client.join(`user:${userId}`);
      
      // Emit unread messages count
      const unreadMessages = await this.chatsService.getUnreadMessages(userId);
      client.emit('unread_count', unreadMessages.length);
      
    } catch (error) {
      console.error('Chat: Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`Chat: User ${userId} disconnected`);
    }
  }

  private toRecipientRole(role: Role): NotificationRecipientRole {
    return role as unknown as NotificationRecipientRole;
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { receiverId: string; message: string; imageUrl?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;
    console.log('Received send_message event:', { senderId, data });
    if (!senderId) {
      console.error('User not authenticated');
      return { error: 'User not authenticated' };
    }

    try {
      // Get sender and receiver roles for validation
      const sender = await this.usersService.findOne(senderId);
      const receiver = await this.usersService.findOne(data.receiverId);
      
      if (!sender || !receiver) {
        console.error('User not found:', { sender: !!sender, receiver: !!receiver });
        return { error: 'User not found' };
      }

      console.log('Creating message with roles:', { senderRole: sender.role, receiverRole: receiver.role });
      const chatMessage = await this.chatsService.createMessage(
        senderId,
        data.receiverId,
        data.message,
        sender.role,
        receiver.role,
        data.imageUrl,
      );
      console.log('Message created:', chatMessage);

      // Create notification for the receiver
      try {
        const senderName = sender ? `${sender.nom} ${sender.prenom}` : 'Unknown';
        await this.notificationsService.create({
          message: `New message from ${senderName}: ${data.message.substring(0, 80)}${data.message.length > 80 ? '...' : ''}`,
          type: NotificationType.CHAT_MESSAGE,
          userEmail: receiver.email,
          userName: senderName,
          recipientRoles: [this.toRecipientRole(receiver.role)],
          referenceId: chatMessage._id.toString(),
          referenceModel: 'Chat',
        });
      } catch (notifError) {
        console.error('Failed to create chat notification:', notifError);
      }

      // Send to receiver if online
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(`user:${data.receiverId}`).emit('new_message', chatMessage);
        console.log('Message sent to receiver');
      }

      // Send confirmation to sender
      client.emit('message_sent', chatMessage);
      console.log('Message confirmation sent to sender');

      return { success: true, message: chatMessage };
    } catch (error) {
      console.error('Error sending message:', error);
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

  @SubscribeMessage('toggle_reaction')
  async handleToggleReaction(
    @MessageBody() data: { messageId: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) return { error: 'User not authenticated' };

    try {
      const updatedMessage = await this.chatsService.addReaction(data.messageId, userId, data.emoji);

      // Re-fetch with populated reactions
      const populated = await this.chatsService.getMessageById(data.messageId);
      const reactions = populated?.reactions || updatedMessage.reactions;
      
      // Notify both sender and receiver about the reaction update
      const senderId = updatedMessage.sender.toString();
      const receiverId = updatedMessage.receiver.toString();
      
      this.server.to(`user:${senderId}`).emit('message_reaction', { messageId: data.messageId, reactions });
      this.server.to(`user:${receiverId}`).emit('message_reaction', { messageId: data.messageId, reactions });
      
      return { success: true };
    } catch (error) {
      return { error: 'Failed to toggle reaction' };
    }
  }
}
