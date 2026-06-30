import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role, Status } from '../user.schema';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  prenom?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;

  @IsString()
  @IsOptional()
  profilePicture?: string;
}
