import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';
import { Role } from '../users/user.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
  ) {}

  async createMessage(senderId: string, receiverId: string, message: string, senderRole: Role, receiverRole: Role, imageUrl?: string): Promise<Chat> {
    // Validation: either message or imageUrl must be present
    if (!message && !imageUrl) {
      throw new Error('Either message or imageUrl is required');
    }

    // Validate conversation is allowed based on roles
    if (!this.isConversationAllowed(senderRole, receiverRole)) {
      throw new ForbiddenException('Conversation not allowed between these roles');
    }
    
    const chat = new this.chatModel({
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      imageUrl,
      read: false,
    });
    const saved = await chat.save();
    const populated = await this.chatModel
      .findById(saved._id)
      .populate('sender', 'nom prenom email profilePicture role')
      .populate('receiver', 'nom prenom email profilePicture role')
      .exec();
    return populated!;
  }

  async getConversation(userId1: string, userId2: string, limit: number = 50): Promise<Chat[]> {
    return this.chatModel
      .find({
        $or: [
          { sender: userId1, receiver: userId2 },
          { sender: userId2, receiver: userId1 },
        ],
      })
      .populate('sender', 'nom prenom email profilePicture')
      .populate('receiver', 'nom prenom email profilePicture')
      .populate('reactions.userId', 'nom prenom')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getUnreadMessages(userId: string): Promise<Chat[]> {
    return this.chatModel
      .find({ receiver: userId, read: false })
      .populate('sender', 'nom prenom email profilePicture')
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(messageId: string, userId: string): Promise<Chat> {
    const message = await this.chatModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    if (message.receiver.toString() !== userId) {
      throw new ForbiddenException('You can only mark messages sent to you as read');
    }
    message.read = true;
    return message.save();
  }

  async markConversationAsRead(senderId: string, receiverId: string): Promise<void> {
    await this.chatModel.updateMany(
      { sender: senderId, receiver: receiverId, read: false },
      { read: true },
    );
  }

  async getConversationsForUser(userId: string, userRole: Role): Promise<any[]> {
    let matchQuery: any = {};

    if (userRole === Role.CONSULTANT) {
      // Consultant can only see conversations with IT and ADMIN
      matchQuery = {
        $or: [
          { sender: userId },
          { receiver: userId },
        ],
      };
    } else {
      // IT and ADMIN can see all conversations (filtered later)
      matchQuery = {
        $or: [
          { sender: userId },
          { receiver: userId },
        ],
      };
    }

    const conversations = await this.chatModel
      .find(matchQuery)
      .populate('sender', 'nom prenom email profilePicture role')
      .populate('receiver', 'nom prenom email profilePicture role')
      .sort({ createdAt: -1 })
      .exec();

    // Group by conversation partner and get latest message
    const conversationMap = new Map<string, any>();

    for (const chat of conversations) {
      const partnerId = chat.sender._id.toString() === userId 
        ? chat.receiver._id.toString() 
        : chat.sender._id.toString();
      
      const partner = chat.sender._id.toString() === userId ? chat.receiver : chat.sender;
      
      console.log(`Chat: sender=${chat.sender._id}, receiver=${chat.receiver._id}, userId=${userId}`);
      console.log(`Partner ID: ${partnerId}, Partner:`, partner);
      
      // Check if conversation is allowed based on roles
      const partnerRole = (partner as any).role;
      if (!this.isConversationAllowed(userRole, partnerRole)) {
        console.log(`Filtering out conversation with partner role ${partnerRole} for user role ${userRole}`);
        continue;
      }
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partner,
          lastMessage: chat,
          unreadCount: 0,
        });
      }

      if (chat.receiver._id.toString() === userId && !chat.read) {
        conversationMap.get(partnerId).unreadCount++;
      }
    }

    console.log(`Found ${conversationMap.size} conversations for user ${userId} with role ${userRole}`);
    return Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  }

  async getMessageById(messageId: string): Promise<Chat | null> {
    return this.chatModel
      .findById(messageId)
      .populate('sender', 'nom prenom email profilePicture role')
      .populate('receiver', 'nom prenom email profilePicture role')
      .populate('reactions.userId', 'nom prenom')
      .exec();
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<Chat> {
    const message = await this.chatModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    
    // Check if user already reacted with same emoji - toggle off
    const existing = message.reactions.findIndex(
      r => r.userId.toString() === userId && r.emoji === emoji
    );
    
    if (existing >= 0) {
      message.reactions.splice(existing, 1);
    } else {
      // Remove any existing reaction from this user first (one reaction per user per message)
      message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
      message.reactions.push({ emoji, userId: userId as any });
    }
    
    return message.save();
  }

  private isConversationAllowed(userRole: Role, partnerRole: string): boolean {
    // Role-based conversation rules:
    // IT ↔ Consultant (allowed)
    // IT ↔ Admin (allowed)
    // Admin ↔ IT (allowed)
    // Admin ↔ Consultant (NOT allowed)
    // Consultant ↔ Consultant (NOT allowed)
    // Consultant ↔ Admin (NOT allowed)
    
    if (userRole === Role.CONSULTANT) {
      // Consultants can only chat with IT (NOT Admin)
      return partnerRole === 'IT';
    } else if (userRole === Role.IT) {
      // IT can chat with Consultants and ADMIN
      return partnerRole === 'CONSULTANT' || partnerRole === 'ADMIN';
    } else if (userRole === Role.ADMIN) {
      // Admin can only chat with IT (NOT Consultants)
      return partnerRole === 'IT';
    }
    
    return false;
  }
}
