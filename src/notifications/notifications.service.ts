import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const createdNotification = new this.notificationModel(createNotificationDto);
    return createdNotification.save();
  }

  async findAll(): Promise<Notification[]> {
    return this.notificationModel.find().sort({ createdAt: -1 }).exec();
  }

  async findUnread(): Promise<Notification[]> {
    return this.notificationModel.find({ read: false }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Notification> {
    return this.notificationModel.findById(id).exec();
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.notificationModel.findByIdAndUpdate(id, { read: true }, { new: true }).exec();
  }

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    return this.notificationModel.updateMany({ read: false }, { read: true }).exec();
  }

  async remove(id: string): Promise<Notification> {
    return this.notificationModel.findByIdAndDelete(id).exec();
  }

  async clearAll(): Promise<{ deletedCount: number }> {
    return this.notificationModel.deleteMany({}).exec();
  }
}
