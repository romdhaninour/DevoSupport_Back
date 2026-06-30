import { IsString, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { NotificationType } from '../notification.schema';

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
}
