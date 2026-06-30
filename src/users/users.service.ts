import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, Role, Status } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // Create a new user
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userModel.findOne({ email: createUserDto.email });
    if (existing) {
      throw new ConflictException(`Email ${createUserDto.email} already exists`);
    }
    
    const user = new this.userModel({
    ...createUserDto,
    status: Status.INACTIVE,
  });   
   return user.save();
  }

  // Get all users (excluding archived by default)
  async findAll(includeArchived = false): Promise<User[]> {
    const filter = includeArchived ? {} : { status: { $ne: Status.ARCHIVED } };
    return this.userModel.find(filter).exec();
  }

  // Get only archived users
  async findArchived(): Promise<User[]> {
    return this.userModel.find({ status: Status.ARCHIVED }).exec();
  }

  // Get users by role
  async findByRole(role: Role): Promise<User[]> {
    return this.userModel.find({ role, status: { $ne: Status.ARCHIVED } }).exec();
  }

  // Get all consultants (IT + CONSULTANT roles)
  async findConsultants(): Promise<User[]> {
    return this.userModel.find({
      isConsultant: true,
      status: { $ne: Status.ARCHIVED },
    }).exec();
  }

  // Get one user by ID
  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  // Get user by email
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Update user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  // Activate user
  async activate(id: string): Promise<User> {
    return this.update(id, { status: Status.ACTIVE });
  }

  // Deactivate user
  async deactivate(id: string): Promise<User> {
    return this.update(id, { status: Status.INACTIVE });
  }

  // Archive user (soft delete)
  async archive(id: string): Promise<User> {
    return this.update(id, { status: Status.ARCHIVED });
  }

  // Restore archived user
  async restore(id: string): Promise<User> {
    return this.update(id, { status: Status.ACTIVE });
  }

  // Hard delete
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return { message: `User ${user.email} deleted successfully` };
  }
}
