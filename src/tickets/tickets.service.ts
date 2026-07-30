import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketStatus, ResolutionType } from './schemas/ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { Role } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationRecipientRole } from '../notifications/notification.schema';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    private usersService: UsersService,
    private devicesService: DevicesService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createTicketDto: CreateTicketDto): Promise<Ticket> {
    // Validate that deviceId is provided
    if (!createTicketDto.deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    // Validate that the device exists
    const device = await this.devicesService.findOne(createTicketDto.deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Get the user to check their role
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only consultants can only create tickets for devices assigned to them
    // IT and Admin users can create tickets for any device
    if (user.role === Role.CONSULTANT && device.assignedTo?.toString() !== userId) {
      throw new ForbiddenException('You can only create tickets for devices assigned to you');
    }

    await this.devicesService.updateStatus(createTicketDto.deviceId, {
      status: 'maintenance',
    } as any);

    const createdTicket = new this.ticketModel({
      ...createTicketDto,
      device: new Types.ObjectId(createTicketDto.deviceId),
      createdBy: new Types.ObjectId(userId),
      status: TicketStatus.OPEN,
      priority: createTicketDto.priority || 'medium',
      comments: [],
    });

    const savedTicket = await createdTicket.save();
    const populatedTicket = await this.ticketModel.findById(savedTicket._id)
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .exec();

    // Create notification
    try {
      const creatorName = user ? `${user.nom} ${user.prenom}` : 'Unknown';
      const deviceName = device ? device.name : 'Unknown';
      await this.notificationsService.create({
        message: `New ticket "${createTicketDto.title}" created for device "${deviceName}" by ${creatorName}`,
        type: NotificationType.TICKET_CREATED,
        userEmail: user.email,
        userName: creatorName,
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: savedTicket._id.toString(),
        referenceModel: 'Ticket',
      });
    } catch (e) {
      console.error('Failed to create ticket notification', e);
    }

    return populatedTicket!;
  }

  async findAll(
    userId: string,
    role: Role,
    status?: string,
    priority?: string,
    issueType?: string,
    startDate?: string,
    endDate?: string,
    mine?: boolean,
    sortOrder?: string,
  ): Promise<{ tickets: Ticket[]; total: number }> {
    let query = this.ticketModel.find();

    // Personal tickets override the role-based view
    if (mine) {
      query = query.where({ createdBy: new Types.ObjectId(userId) });
    } else if (role !== Role.IT && role !== Role.ADMIN) {
      // CONSULTANT: only their own tickets
      query = query.where({ createdBy: new Types.ObjectId(userId) });
    }

    // Optional filters (for IT/ADMIN)
    if (status) {
      query = query.where({ status });
    }
    if (priority) {
      query = query.where({ priority });
    }
    if (issueType) {
      query = query.where({ issueType });
    }
    if (startDate) {
      query = query.where({ createdAt: { $gte: new Date(startDate) } });
    }
    if (endDate) {
      query = query.where({ createdAt: { $lte: new Date(endDate) } });
    }

    const tickets = await query
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .sort(sortOrder === 'asc' ? { createdAt: 1 as const } : { createdAt: -1 as const })
      .exec();
    const total = await this.ticketModel.countDocuments(query.getFilter()).exec();

    return { tickets, total };
  }

  async findByUserId(targetUserId: string): Promise<Ticket[]> {
    const tickets = await this.ticketModel.find({
      $or: [
        { createdBy: new Types.ObjectId(targetUserId) },
        { assignedTo: new Types.ObjectId(targetUserId) },
      ],
    })
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .sort({ createdAt: -1 })
      .exec();

    return tickets;
  }

  async findOne(id: string, userId: string, role: Role): Promise<Ticket> {
    const ticket = await this.ticketModel.findById(id)
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Role-based access control
    if (role !== Role.IT && role !== Role.ADMIN) {
      // CONSULTANT: can only view their own tickets
      if (ticket.createdBy.toString() !== userId) {
        throw new ForbiddenException('You can only view your own tickets');
      }
    }

    return ticket;
  }

  async updateStatus(
    id: string,
    updateTicketStatusDto: UpdateTicketStatusDto,
  ): Promise<Ticket> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Validate status transition
    if (updateTicketStatusDto.status) {
      ticket.status = updateTicketStatusDto.status;

      // Set resolvedAt when status becomes 'resolved'
      if (updateTicketStatusDto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }

      // Clear resolvedAt if status moves away from 'resolved'
      if (updateTicketStatusDto.status !== TicketStatus.RESOLVED) {
        ticket.resolvedAt = null as any;
      }
    }

    // Set resolution if provided
    if (updateTicketStatusDto.resolution) {
      ticket.resolution = updateTicketStatusDto.resolution;

      // TODO: Consider auto-retiring device when issueType is 'destroyed' and resolution is 'replace'
      // This would require updating the device status to 'retired' in the devices collection
    }

    const savedTicket = await ticket.save();
    const populatedTicket = await this.ticketModel.findById(savedTicket._id)
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .exec();

    // Create notification
    try {
      await this.notificationsService.create({
        message: `Ticket "${ticket.title}" status changed to ${updateTicketStatusDto.status}`,
        type: NotificationType.TICKET_STATUS_CHANGED,
        userEmail: ticket.createdBy.toString(),
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: savedTicket._id.toString(),
        referenceModel: 'Ticket',
      });
    } catch (e) {
      console.error('Failed to create ticket status notification', e);
    }

    return populatedTicket!;
  }

  async assignTicket(id: string, assignTicketDto: AssignTicketDto): Promise<Ticket> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Validate that the assigned user exists and is IT or ADMIN
    const assignedUser = await this.usersService.findOne(assignTicketDto.assignedTo);
    if (!assignedUser) {
      throw new NotFoundException('Assigned user not found');
    }

    if (assignedUser.role !== Role.IT && assignedUser.role !== Role.ADMIN) {
      throw new BadRequestException('Tickets can only be assigned to IT or ADMIN staff');
    }

    ticket.assignedTo = new Types.ObjectId(assignTicketDto.assignedTo);
    const savedTicket = await ticket.save();
    const populatedTicket = await this.ticketModel.findById(savedTicket._id)
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .exec();

    // Create notification
    try {
      const assignedToName = assignedUser ? `${assignedUser.nom} ${assignedUser.prenom}` : 'Unknown';
      await this.notificationsService.create({
        message: `Ticket "${ticket.title}" has been assigned to ${assignedToName}`,
        type: NotificationType.TICKET_ASSIGNED,
        userEmail: assignedUser.email,
        userName: assignedToName,
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: savedTicket._id.toString(),
        referenceModel: 'Ticket',
      });
    } catch (e) {
      console.error('Failed to create ticket assignment notification', e);
    }

    return populatedTicket!;
  }

  async addComment(
    id: string,
    userId: string,
    role: Role,
    addCommentDto: AddCommentDto,
  ): Promise<Ticket> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Role-based access control for comments
    if (role !== Role.IT && role !== Role.ADMIN) {
      // CONSULTANT: can only comment on their own tickets
      if (ticket.createdBy.toString() !== userId) {
        throw new ForbiddenException('You can only comment on your own tickets');
      }
    }

    ticket.comments.push({
      author: new Types.ObjectId(userId),
      text: addCommentDto.text,
      createdAt: new Date(),
    });

    const savedTicket = await ticket.save();
    const populatedTicket = await this.ticketModel.findById(savedTicket._id)
      .populate('device', 'name type')
      .populate('createdBy', 'nom prenom email')
      .populate('assignedTo', 'nom prenom email')
      .populate('comments.author', 'nom prenom email')
      .exec();

    // Create notification
    try {
      const user = await this.usersService.findOne(userId);
      const commenterName = user ? `${user.nom} ${user.prenom}` : 'Unknown';
      await this.notificationsService.create({
        message: `New comment on ticket "${ticket.title}" by ${commenterName}`,
        type: NotificationType.TICKET_COMMENT_ADDED,
        userEmail: user?.email || '',
        userName: commenterName,
        recipientRoles: [NotificationRecipientRole.ADMIN, NotificationRecipientRole.IT],
        referenceId: savedTicket._id.toString(),
        referenceModel: 'Ticket',
      });
    } catch (e) {
      console.error('Failed to create ticket comment notification', e);
    }

    return populatedTicket!;
  }

  async deleteTicket(id: string): Promise<{ message: string }> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    await this.ticketModel.findByIdAndDelete(id);
    return { message: 'Ticket deleted successfully' };
  }
}
