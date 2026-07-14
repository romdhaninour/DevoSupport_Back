import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket, TicketStatus, IssueType, TicketPriority, ResolutionType } from './schemas/ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { Role } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketModel: any;
  let devicesService: any;
  let usersService: any;

  const mockTicketData = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Broken screen',
    description: 'Screen is cracked',
    device: '507f1f77bcf86cd799439012',
    issueType: IssueType.DAMAGED,
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    createdBy: '507f1f77bcf86cd799439013',
    assignedTo: null,
    comments: [],
    resolvedAt: null,
  };

  const mockTicket = {
    ...mockTicketData,
    save: jest.fn().mockResolvedValue(mockTicketData),
    comments: [],
    createdBy: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439013'),
    _id: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439011'),
    device: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439012'),
    assignedTo: null,
  };

  const mockDevice = {
    _id: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439012'),
    name: 'Laptop 1',
    assignedTo: '507f1f77bcf86cd799439013',
  };

  const mockUser = {
    _id: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439013'),
    role: Role.CONSULTANT,
  };

  const mockITUser = {
    _id: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439014'),
    role: Role.IT,
  };

  const createQueryChain = (result: any) => {
    if (!result) {
      return {
        where: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        getFilter: jest.fn().mockReturnValue({}),
        exec: jest.fn().mockResolvedValue(null),
      };
    }
    
    const ticketWithMethods = {
      ...result,
      save: jest.fn().mockResolvedValue(result),
      comments: Array.isArray(result.comments) ? [...result.comments] : [],
      createdBy: result.createdBy || new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439013'),
      _id: result._id || new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439011'),
      device: result.device || new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439012'),
      assignedTo: result.assignedTo || null,
      toString: function() { return this._id.toString(); },
    };
    
    return {
      where: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      getFilter: jest.fn().mockReturnValue({}),
      exec: jest.fn().mockResolvedValue(ticketWithMethods),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: getModelToken(Ticket.name),
          useValue: {
            new: jest.fn().mockImplementation((data: any) => ({
              ...data,
              save: jest.fn().mockResolvedValue({ ...mockTicketData, ...data }),
            })),
            constructor: jest.fn().mockResolvedValue(mockTicket),
            find: jest.fn().mockImplementation(() => createQueryChain([mockTicket])),
            findById: jest.fn().mockImplementation((id: string) => {
              // Return a fresh ticket with methods for each findById call
              return createQueryChain({ ...mockTicket, _id: id });
            }),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(1),
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockITUser),
          },
        },
        {
          provide: DevicesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockDevice),
            updateStatus: jest.fn().mockResolvedValue({ ...mockDevice, status: 'maintenance' }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    ticketModel = module.get(getModelToken(Ticket.name));
    devicesService = module.get(DevicesService);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a ticket successfully when device is assigned to user', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'Broken screen',
        description: 'Screen is cracked',
        deviceId: '507f1f77bcf86cd799439012',
        issueType: IssueType.DAMAGED,
        priority: TicketPriority.MEDIUM,
      };

      devicesService.findOne.mockResolvedValue(mockDevice);

      const result = await service.create('507f1f77bcf86cd799439013', createTicketDto);

      expect(result).toBeDefined();
      expect(devicesService.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(devicesService.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439012', { status: 'maintenance' });
    });

    it('should throw NotFoundException when device does not exist', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'Broken screen',
        description: 'Screen is cracked',
        deviceId: 'nonexistent',
        issueType: IssueType.DAMAGED,
      };

      devicesService.findOne.mockResolvedValue(null);

      await expect(service.create('507f1f77bcf86cd799439013', createTicketDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when device is not assigned to user', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'Broken screen',
        description: 'Screen is cracked',
        deviceId: '507f1f77bcf86cd799439012',
        issueType: IssueType.DAMAGED,
      };

      const unassignedDevice = { ...mockDevice, assignedTo: 'otherUser' };
      devicesService.findOne.mockResolvedValue(unassignedDevice);

      await expect(service.create('507f1f77bcf86cd799439013', createTicketDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return only user\'s own tickets for CONSULTANT role', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439013', Role.CONSULTANT);

      expect(result.tickets).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('should filter to the current user\'s tickets when mine mode is enabled for IT role', async () => {
      const whereSpy = jest.fn().mockReturnThis();
      const queryBuilder = {
        where: whereSpy,
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        getFilter: jest.fn().mockReturnValue({}),
        exec: jest.fn().mockResolvedValue([mockTicket]),
      };
      ticketModel.find.mockReturnValue(queryBuilder);

      await service.findAll('507f1f77bcf86cd799439014', Role.IT, undefined, undefined, undefined, undefined, undefined, true);

      expect(whereSpy).toHaveBeenCalledWith({ createdBy: expect.anything() });
    });

    it('should return all tickets for IT role', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439014', Role.IT);

      expect(result.tickets).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439014', Role.IT, 'open');

      expect(result.tickets).toBeDefined();
    });

    it('should filter by priority when provided', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439014', Role.IT, undefined, 'high');

      expect(result.tickets).toBeDefined();
    });

    it('should filter by issueType when provided', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439014', Role.IT, undefined, undefined, 'damaged');

      expect(result.tickets).toBeDefined();
    });

    it('should filter by date range when provided', async () => {
      const result = await service.findAll('507f1f77bcf86cd799439014', Role.IT, undefined, undefined, undefined, '2024-01-01', '2024-12-31');

      expect(result.tickets).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a ticket for IT role', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439014', Role.IT);

      expect(result).toBeDefined();
    });

    it('should return own ticket for CONSULTANT role', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013', Role.CONSULTANT);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when CONSULTANT tries to view someone else\'s ticket', async () => {
      const otherUserTicket = { ...mockTicket, createdBy: '507f1f77bcf86cd799439014' };
      ticketModel.findById.mockImplementation(() => createQueryChain(otherUserTicket));

      await expect(service.findOne('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013', Role.CONSULTANT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketModel.findById.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', '507f1f77bcf86cd799439013', Role.CONSULTANT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status successfully', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.IN_PROGRESS,
      };

      const result = await service.updateStatus('ticket123', updateTicketStatusDto);

      expect(result).toBeDefined();
    });

    it('should set resolvedAt when status becomes resolved', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.RESOLVED,
      };

      const ticketWithoutResolvedAt = { ...mockTicket, resolvedAt: null };
      ticketModel.findById.mockImplementation(() => createQueryChain(ticketWithoutResolvedAt));

      const result = await service.updateStatus('507f1f77bcf86cd799439011', updateTicketStatusDto);

      expect(result).toBeDefined();
    });

    it('should clear resolvedAt when status moves away from resolved', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.OPEN,
      };

      const ticketWithResolvedAt = { ...mockTicket, resolvedAt: new Date() };
      ticketModel.findById.mockImplementation(() => createQueryChain(ticketWithResolvedAt));

      const result = await service.updateStatus('507f1f77bcf86cd799439011', updateTicketStatusDto);

      expect(result).toBeDefined();
    });

    it('should set resolution when provided', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.RESOLVED,
        resolution: ResolutionType.REPAIR,
      };

      const result = await service.updateStatus('ticket123', updateTicketStatusDto);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.IN_PROGRESS,
      };

      ticketModel.findById.mockImplementation(() => createQueryChain(null));

      await expect(service.updateStatus('nonexistent', updateTicketStatusDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket to IT staff successfully', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: '507f1f77bcf86cd799439014',
      };

      const result = await service.assignTicket('507f1f77bcf86cd799439011', assignTicketDto);

      expect(result).toBeDefined();
      expect(usersService.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439014');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: '507f1f77bcf86cd799439014',
      };

      ticketModel.findById.mockImplementation(() => createQueryChain(null));

      await expect(service.assignTicket('nonexistent', assignTicketDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when assigned user does not exist', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: '507f1f77bcf86cd799439015',
      };

      usersService.findOne.mockResolvedValue(null);

      await expect(service.assignTicket('ticket123', assignTicketDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when trying to assign to non-IT user', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: '507f1f77bcf86cd799439013',
      };

      usersService.findOne.mockResolvedValue(mockUser);

      await expect(service.assignTicket('ticket123', assignTicketDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addComment', () => {
    it('should add comment to own ticket for CONSULTANT', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      const result = await service.addComment('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013', Role.CONSULTANT, addCommentDto);

      expect(result).toBeDefined();
    });

    it('should add comment to any ticket for IT role', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      const result = await service.addComment('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439014', Role.IT, addCommentDto);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when CONSULTANT tries to comment on someone else\'s ticket', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      const otherUserTicket = { ...mockTicket, createdBy: new (require('mongoose').Types.ObjectId)('507f1f77bcf86cd799439014') };
      ticketModel.findById.mockImplementation(() => createQueryChain(otherUserTicket));

      await expect(service.addComment('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013', Role.CONSULTANT, addCommentDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      ticketModel.findById.mockImplementation(() => createQueryChain(null));

      await expect(service.addComment('nonexistent', '507f1f77bcf86cd799439013', Role.CONSULTANT, addCommentDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
