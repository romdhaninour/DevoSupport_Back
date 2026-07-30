import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createUserDto: CreateUserDto) {
    const userRole = req.user?.role;
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can create users');
    }
    return this.usersService.create(createUserDto);
  }

  // GET /users
  // GET /users?archived=true
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any, @Query('archived') archived?: string, @Query('sortOrder') sortOrder?: string) {
    return this.usersService.findAll(archived === 'true', sortOrder);
  }

  // GET /users/archived
  @Get('archived')
  findArchived() {
    return this.usersService.findArchived();
  }

  // GET /users/consultants  (IT + CONSULTANT)
  @Get('consultants')
  findConsultants() {
    return this.usersService.findConsultants();
  }

  // GET /users/me and GET /users/me/profile
  @Get(['me', 'me/profile'])
  @UseGuards(JwtAuthGuard)
  findCurrentUser(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.usersService.findOne(userId);
  }

  // GET /users/role/IT
  @Get('role/:role')
  findByRole(@Param('role') role: Role) {
    return this.usersService.findByRole(role);
  }

  // GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // GET /users/:id/profile-picture
  @Get(':id/profile-picture')
  async getProfilePicture(@Param('id') id: string, @Res() res: Response) {
    const user = await this.usersService.findOne(id);
    if (!user || !(user as any).profilePicture) {
      return res.status(404).send('Profile picture not found');
    }

    const profilePictureUrl = (user as any).profilePicture;

    try {
      const response = await fetch(profilePictureUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch profile picture');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      res.status(500).send('Failed to fetch profile picture');
    }
  }

  // PATCH /users/:id
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user?.sub;
    const userRole = req.user?.role;

    // Users can only update their own profile, admins can update any
    if (userRole !== Role.ADMIN && userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.usersService.update(id, updateUserDto);
  }

  // PATCH /users/:id/activate
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  // PATCH /users/:id/deactivate
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // PATCH /users/:id/archive
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.usersService.archive(id);
  }

  // PATCH /users/:id/restore
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  // DELETE /users/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // POST /users/import
  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importUsers(@Req() req: any, @UploadedFile() file: any) {
    const userRole = req.user?.role;
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can import users');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.usersService.importUsers(file);
  }

  // POST /users/export
  @Post('export')
  @UseGuards(JwtAuthGuard)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename=utilisateurs.xlsx')
  async exportUsers(
    @Req() req: any,
    @Body() body: { search?: string },
    @Res() res: Response,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can export users');
    }
    const buffer = await this.usersService.exportUsers(body?.search);
    res.send(buffer);
  }
}
