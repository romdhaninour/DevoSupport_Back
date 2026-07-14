import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationRecipientRole } from './notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const createdNotification = new this.notificationModel(
      createNotificationDto,
    );
    const saved = await createdNotification.save();
    
    // Broadcast via WebSocket
    try {
      this.notificationsGateway.broadcastNotification(saved);
    } catch (e) {
      console.error('Failed to broadcast notification', e);
    }
    
    return saved;
  }

  async findAll(userRole?: string): Promise<Notification[]> {
    const query: any = {};
    if (userRole) {
      query.recipientRoles = { $in: [userRole] };
    }
    return this.notificationModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findUnread(userRole?: string): Promise<Notification[]> {
    const query: any = { read: false };
    if (userRole) {
      query.recipientRoles = { $in: [userRole] };
    }
    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async getUnreadCount(userRole?: string): Promise<number> {
    const query: any = { read: false };
    if (userRole) {
      query.recipientRoles = { $in: [userRole] };
    }
    return this.notificationModel.countDocuments(query).exec();
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }
    return notification;
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationModel
      .findByIdAndUpdate(id, { read: true }, { new: true })
      .exec();
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }
    return notification;
  }

  async markAllAsRead(userRole?: string): Promise<{ modifiedCount: number }> {
    const query: any = { read: false };
    if (userRole) {
      query.recipientRoles = { $in: [userRole] };
    }
    return this.notificationModel
      .updateMany(query, { read: true })
      .exec();
  }

  async remove(id: string): Promise<Notification> {
    const notification = await this.notificationModel
      .findByIdAndDelete(id)
      .exec();
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }
    return notification;
  }

  async clearAll(): Promise<{ deletedCount: number }> {
    return this.notificationModel.deleteMany({}).exec();
  }
}
