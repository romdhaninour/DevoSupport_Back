import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, Role, Status } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // Create a new user
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existing) {
      throw new ConflictException(
        `Email ${createUserDto.email} already exists`,
      );
    }

    const user = new this.userModel({
      ...createUserDto,
      status: Status.INACTIVE,
    });
    return user.save();
  }

  // Get all users (excluding archived by default)
  async findAll(includeArchived = false, sortOrder?: string): Promise<User[]> {
    const filter = includeArchived ? {} : { status: { $ne: Status.ARCHIVED } };
    const sort = sortOrder === 'asc' ? { createdAt: 1 as const } : { createdAt: -1 as const };
    return this.userModel.find(filter).sort(sort).exec();
  }

  // Get only archived users
  async findArchived(): Promise<User[]> {
    return this.userModel.find({ status: Status.ARCHIVED }).exec();
  }

  // Get users by role
  async findByRole(role: Role): Promise<User[]> {
    return this.userModel
      .find({ role, status: { $ne: Status.ARCHIVED } })
      .exec();
  }

  // Get all consultants and admins that can be allocated devices
  async findConsultants(): Promise<User[]> {
    return this.userModel
      .find({
        $or: [
          { role: Role.IT },
          { role: Role.CONSULTANT },
          { role: Role.ADMIN },
          { isConsultant: true },
        ],
        status: { $ne: Status.ARCHIVED },
      })
      .exec();
  }

  // Get one user by ID
  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  // Get user by email
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email?.trim().toLowerCase();
    return this.userModel.findOne({ email: normalizedEmail }).exec();
  }

  // Update user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { returnDocument: 'after' })
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
    return this.update(id, { status: Status.INACTIVE });
  }

  // Hard delete
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return { message: `User ${user.email} deleted successfully` };
  }

  async importUsers(
    file: any,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('No worksheet found in the file');
    }

    const users: CreateUserDto[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Get header row to map column indices
    const headerRow = worksheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString()?.trim().toLowerCase();
      if (header) {
        headerMap[header] = colNumber;
      }
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      // Helper to get cell value by header name
      const getValue = (headers: string[]): string => {
        for (const header of headers) {
          const colIndex = headerMap[header.toLowerCase()];
          if (colIndex) {
            const val = row.getCell(colIndex).value;
            if (typeof val === 'object' && val !== null) {
              if (val.text) return val.text.toString().trim();
              if (val.richText) return val.richText.map((t: any) => t.text || '').join('').trim();
              return (val as any).toString?.()?.trim() || '';
            }
            return val?.toString()?.trim() || '';
          }
        }
        return '';
      };

      const nom = getValue(['nom', 'name', 'last_name', 'nom de famille', 'lastname', 'surname']);
      const prenom = getValue(['prenom', 'prénom', 'first_name', 'firstName', 'prenom', 'given_name', 'givenname']);
      const email = getValue(['email', 'mail', 'email address', 'e-mail', 'courriel', 'adresse email', 'adresse e-mail']);
      const role = getValue(['role', 'rôle']) || 'CONSULTANT';

      if (!nom || !prenom || !email) {
        errors.push(
          `Row ${rowNumber}: Missing required fields (nom, prenom, email)`,
        );
        failedCount++;
        return;
      }

      // Validate role
      const validRoles = ['ADMIN', 'IT', 'CONSULTANT'];
      const normalizedRole = role.toUpperCase();
      if (!validRoles.includes(normalizedRole)) {
        errors.push(
          `Row ${rowNumber}: Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
        );
        failedCount++;
        return;
      }

      users.push({
        nom,
        prenom,
        email: email.toLowerCase(),
        role: normalizedRole as Role,
      });
      successCount++;
    });

    for (const user of users) {
      try {
        await this.create(user);
      } catch (error: any) {
        errors.push(`Failed to create user "${user.email}": ${error.message}`);
        failedCount++;
        successCount--;
      }
    }

    return { success: successCount, failed: failedCount, errors };
  }

  async exportUsers(search?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    // Define columns
    worksheet.columns = [
      { header: 'nom', key: 'nom', width: 20 },
      { header: 'prenom', key: 'prenom', width: 20 },
      { header: 'email', key: 'email', width: 30 },
      { header: 'role', key: 'role', width: 15 },
      { header: 'status', key: 'status', width: 15 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Get users with optional search filter
    let query = this.userModel.find({ status: { $ne: Status.ARCHIVED } });
    if (search) {
      query = query.or([
        { nom: { $regex: search, $options: 'i' } },
        { prenom: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]);
    }
    const users = await query.sort({ createdAt: -1 }).exec();

    // Add data rows
    users.forEach((user, index) => {
      const row = worksheet.addRow({
        nom: user.nom || '',
        prenom: user.prenom || '',
        email: user.email || '',
        role: user.role || '',
        status: user.status || '',
      });

      // Zebra striping
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      }

      // Status color coding
      const statusCell = row.getCell(5);
      if (user.status === Status.ACTIVE) {
        statusCell.font = { color: { argb: 'FF00B050' } };
      } else if (user.status === Status.INACTIVE) {
        statusCell.font = { color: { argb: 'FFFFC000' } };
      } else if (user.status === Status.ARCHIVED) {
        statusCell.font = { color: { argb: 'FFC00000' } };
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
