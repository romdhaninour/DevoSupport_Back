import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  USER_SIGNUP = 'user_signup',
  ACTIVATION = 'activation',
  DEVICE_ALLOCATED = 'device_allocated',
  DEVICE_RETURNED = 'device_returned',
  DEVICE_STATUS_CHANGED = 'device_status_changed',
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_STATUS_CHANGED = 'ticket_status_changed',
  TICKET_COMMENT_ADDED = 'ticket_comment_added',
  CHAT_MESSAGE = 'chat_message',
  MAINTENANCE_DUE = 'maintenance_due',
  OTHER = 'other',
}

export enum NotificationRecipientRole {
  ADMIN = 'ADMIN',
  IT = 'IT',
  CONSULTANT = 'CONSULTANT',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  message: string;

  @Prop({
    type: String,
    enum: NotificationType,
    default: NotificationType.OTHER,
  })
  type: NotificationType;

  @Prop({ default: false })
  read: boolean;

  @Prop({ required: true })
  userEmail: string;

  @Prop()
  userName?: string;

  @Prop({ type: [String], enum: NotificationRecipientRole, default: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT] })
  recipientRoles: NotificationRecipientRole[];

  @Prop({ required: false })
  referenceId?: string;

  @Prop({ required: false })
  referenceModel?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
