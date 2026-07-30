import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ForbiddenException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { Role } from '../users/user.schema';
import { IssueType, TicketPriority, TicketStatus } from './schemas/ticket.schema';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: TicketsService;

  const mockReq = {
    user: {
      userId: 'user123',
      sub: 'user123',
      role: Role.CONSULTANT,
    },
  };

  const mockITReq = {
    user: {
      userId: 'it123',
      sub: 'it123',
      role: Role.IT,
    },
  };

  const mockTicket = {
    _id: 'ticket123',
    title: 'Broken screen',
    description: 'Screen is cracked',
    device: 'device123',
    issueType: 'damaged',
    status: 'open',
    priority: 'medium',
    createdBy: 'user123',
    assignedTo: null,
    comments: [],
    resolvedAt: null,
  };

  const mockTicketsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    assignTicket: jest.fn(),
    addComment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a ticket', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'Broken screen',
        description: 'Screen is cracked',
        deviceId: 'device123',
        issueType: IssueType.DAMAGED,
        priority: TicketPriority.MEDIUM,
      };

      mockTicketsService.create.mockResolvedValue(mockTicket);

      const result = await controller.create(mockReq as any, createTicketDto);

      expect(result).toEqual(mockTicket);
      expect(service.create).toHaveBeenCalledWith('user123', createTicketDto);
    });
  });

  describe('findAll', () => {
    it('should return all tickets for IT role', async () => {
      const mockResponse = {
        tickets: [mockTicket],
        total: 1,
      };

      mockTicketsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(mockITReq as any);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(
        'it123',
        Role.IT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should return user\'s own tickets for CONSULTANT role', async () => {
      const mockResponse = {
        tickets: [mockTicket],
        total: 1,
      };

      mockTicketsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(mockReq as any);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(
        'user123',
        Role.CONSULTANT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should apply filters when provided', async () => {
      const mockResponse = {
        tickets: [mockTicket],
        total: 1,
      };

      mockTicketsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(mockITReq as any, 'open', 'high', 'damaged', '2024-01-01', '2024-12-31');

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(
        'it123',
        Role.IT,
        'open',
        'high',
        'damaged',
        '2024-01-01',
        '2024-12-31',
        undefined,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('should return a ticket for IT role', async () => {
      mockTicketsService.findOne.mockResolvedValue(mockTicket);

      const result = await controller.findOne('ticket123', mockITReq as any);

      expect(result).toEqual(mockTicket);
      expect(service.findOne).toHaveBeenCalledWith('ticket123', 'it123', Role.IT);
    });

    it('should return own ticket for CONSULTANT role', async () => {
      mockTicketsService.findOne.mockResolvedValue(mockTicket);

      const result = await controller.findOne('ticket123', mockReq as any);

      expect(result).toEqual(mockTicket);
      expect(service.findOne).toHaveBeenCalledWith('ticket123', 'user123', Role.CONSULTANT);
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status for IT role', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.IN_PROGRESS,
      };

      mockTicketsService.updateStatus.mockResolvedValue(mockTicket);

      const result = await controller.updateStatus('ticket123', mockITReq as any, updateTicketStatusDto);

      expect(result).toEqual(mockTicket);
      expect(service.updateStatus).toHaveBeenCalledWith('ticket123', updateTicketStatusDto);
    });

    it('should throw ForbiddenException for CONSULTANT role', async () => {
      const updateTicketStatusDto: UpdateTicketStatusDto = {
        status: TicketStatus.IN_PROGRESS,
      };

      await expect(
        controller.updateStatus('ticket123', mockReq as any, updateTicketStatusDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket for IT role', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: 'it123',
      };

      mockTicketsService.assignTicket.mockResolvedValue(mockTicket);

      const result = await controller.assignTicket('ticket123', mockITReq as any, assignTicketDto);

      expect(result).toEqual(mockTicket);
      expect(service.assignTicket).toHaveBeenCalledWith('ticket123', assignTicketDto);
    });

    it('should throw ForbiddenException for CONSULTANT role', async () => {
      const assignTicketDto: AssignTicketDto = {
        assignedTo: 'it123',
      };

      await expect(
        controller.assignTicket('ticket123', mockReq as any, assignTicketDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addComment', () => {
    it('should add comment for CONSULTANT on own ticket', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      mockTicketsService.addComment.mockResolvedValue(mockTicket);

      const result = await controller.addComment('ticket123', mockReq as any, addCommentDto);

      expect(result).toEqual(mockTicket);
      expect(service.addComment).toHaveBeenCalledWith('ticket123', 'user123', Role.CONSULTANT, addCommentDto);
    });

    it('should add comment for IT on any ticket', async () => {
      const addCommentDto: AddCommentDto = {
        text: 'This is a comment',
      };

      mockTicketsService.addComment.mockResolvedValue(mockTicket);

      const result = await controller.addComment('ticket123', mockITReq as any, addCommentDto);

      expect(result).toEqual(mockTicket);
      expect(service.addComment).toHaveBeenCalledWith('ticket123', 'it123', Role.IT, addCommentDto);
    });
  });
});
