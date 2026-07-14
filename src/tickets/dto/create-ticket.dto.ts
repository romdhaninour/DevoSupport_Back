import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IssueType, TicketPriority } from '../schemas/ticket.schema';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsEnum(IssueType)
  @IsNotEmpty()
  issueType: IssueType;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;
}
