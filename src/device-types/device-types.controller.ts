import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeviceTypesService } from './device-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../users/user.schema';
import { Req } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';

@Controller('device-types')
@UseGuards(JwtAuthGuard)
export class DeviceTypesController {
  constructor(private readonly deviceTypesService: DeviceTypesService) {}

  @Post()
  async create(@Req() req: any, @Body() body: { name: string; description?: string }) {
    this.assertAdminOrIT(req);
    return this.deviceTypesService.create(body.name, body.description);
  }

  @Get()
  findAll(@Query('sortOrder') sortOrder?: string) {
    return this.deviceTypesService.findAll(sortOrder);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deviceTypesService.findOne(id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: { name: string; description?: string }) {
    this.assertAdminOrIT(req);
    return this.deviceTypesService.update(id, body.name, body.description);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    this.assertAdminOrIT(req);
    return this.deviceTypesService.remove(id);
  }

  private assertAdminOrIT(req: any) {
    const role = req.user?.role;
    if (role !== Role.ADMIN && role !== Role.IT) {
      throw new ForbiddenException('Seuls les admins et le staff IT peuvent gérer les types');
    }
  }
}
