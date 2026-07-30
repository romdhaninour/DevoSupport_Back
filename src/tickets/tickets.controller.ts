import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  Query,
  Delete,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../users/user.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async create(@Req() req: any, @Body() createTicketDto: CreateTicketDto) {
    const userId = req.user?.userId || req.user?.sub;
    return this.ticketsService.create(userId, createTicketDto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('issueType') issueType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('mine') mine?: boolean,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    const role = req.user?.role;
    return this.ticketsService.findAll(userId, role, status, priority, issueType, startDate, endDate, mine, sortOrder);
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const role = req.user?.role;
    if (role !== Role.IT && role !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can view tickets by user');
    }
    return this.ticketsService.findByUserId(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const role = req.user?.role;
    return this.ticketsService.findOne(id, userId, role);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can update ticket status');
    }
    return this.ticketsService.updateStatus(id, updateTicketStatusDto);
  }

  @Patch(':id/assign')
  async assignTicket(
    @Param('id') id: string,
    @Req() req: any,
    @Body() assignTicketDto: AssignTicketDto,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can assign tickets');
    }
    return this.ticketsService.assignTicket(id, assignTicketDto);
  }

  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Req() req: any,
    @Body() addCommentDto: AddCommentDto,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    const role = req.user?.role;
    return this.ticketsService.addComment(id, userId, role, addCommentDto);
  }

  @Delete(':id')
  async deleteTicket(@Param('id') id: string, @Req() req: any) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can delete tickets');
    }
    return this.ticketsService.deleteTicket(id);
  }
}
