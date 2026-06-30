import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  USER_SIGNUP = 'user_signup',
  ACTIVATION = 'activation',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, default: NotificationType.OTHER })
  type: NotificationType;

  @Prop({ default: false })
  read: boolean;

  @Prop({ required: true })
  userEmail: string; // Email of the user who triggered the notification

  @Prop()
  userName?: string; // Name of the user who triggered the notification
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
