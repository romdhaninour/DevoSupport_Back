import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketStatus, ResolutionType } from '../schemas/ticket.schema';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(ResolutionType)
  @IsOptional()
  resolution?: ResolutionType;
}
