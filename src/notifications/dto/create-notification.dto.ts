import { IsString, IsEnum, IsOptional, IsEmail, IsArray } from 'class-validator';
import { NotificationType, NotificationRecipientRole } from '../notification.schema';

export class CreateNotificationDto {
  @IsString()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEmail()
  userEmail: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsArray()
  @IsEnum(NotificationRecipientRole, { each: true })
  @IsOptional()
  recipientRoles?: NotificationRecipientRole[];

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  referenceModel?: string;
}
