import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, Role, Status } from '../users/user.schema';
import { Device } from '../devices/device.schema';
import { Ticket, TicketStatus } from '../tickets/schemas/ticket.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Device.name) private readonly deviceModel: Model<Device>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
  ) {}

  async getStats(userId: string, role: Role) {
    if (role === Role.CONSULTANT) {
      return this.getConsultantStats(userId);
    }
    return this.getAdminITStats();
  }

  private async getAdminITStats() {
    const [
      totalUsers,
      usersByRole,
      totalDevices,
      devicesByStatus,
      devicesByType,
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByIssueType,
      recentTickets,
    ] = await Promise.all([
      this.userModel.countDocuments({ status: Status.ACTIVE }),
      this.userModel.aggregate([
        { $match: { status: Status.ACTIVE } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      this.deviceModel.countDocuments(),
      this.deviceModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.deviceModel.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.ticketModel.countDocuments(),
      this.ticketModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $group: { _id: '$issueType', count: { $sum: 1 } } },
      ]),
      this.ticketModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'nom prenom')
        .populate('device', 'name type')
        .lean(),
    ]);

    return {
      totalUsers,
      usersByRole: this.arrayToMap(usersByRole),
      totalDevices,
      devicesByStatus: this.arrayToMap(devicesByStatus),
      devicesByType: this.arrayToMap(devicesByType),
      totalTickets,
      ticketsByStatus: this.arrayToMap(ticketsByStatus),
      ticketsByPriority: this.arrayToMap(ticketsByPriority),
      ticketsByIssueType: this.arrayToMap(ticketsByIssueType),
      recentTickets,
    };
  }

  private async getConsultantStats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const [myDevices, myTickets, myOpenTickets, myInProgressTickets, myRecentTickets] =
      await Promise.all([
        this.deviceModel.countDocuments({
          assignedTo: userId,
          status: 'assigned',
        }),
        this.ticketModel.countDocuments({ createdBy: userObjectId }),
        this.ticketModel.countDocuments({
          createdBy: userObjectId,
          status: TicketStatus.OPEN,
        }),
        this.ticketModel.countDocuments({
          createdBy: userObjectId,
          status: TicketStatus.IN_PROGRESS,
        }),
        this.ticketModel
          .find({ createdBy: userObjectId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('device', 'name type')
          .lean(),
      ]);

    return {
      myDevices,
      myTickets,
      myOpenTickets,
      myInProgressTickets,
      myRecentTickets,
    };
  }

  private arrayToMap(arr: { _id: string; count: number }[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const item of arr) {
      map[item._id] = item.count;
    }
    return map;
  }
}
