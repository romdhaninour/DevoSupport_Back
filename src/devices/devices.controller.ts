import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  ForbiddenException,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../users/user.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { ImageCompressionInterceptor } from '../common/interceptors/image-compression.interceptor';

const devicePhotoStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/devices';
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (e) {
      // ignore
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    cb(null, name);
  },
});

const devicePhotoFilter = (req: any, file: any, cb: any) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const ext = extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: devicePhotoStorage,
      fileFilter: devicePhotoFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    ImageCompressionInterceptor,
  )
  async create(
    @Req() req: any,
    @Body() createDeviceDto: any,
    @UploadedFile() file: any,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }

    const payload = { ...createDeviceDto };
    if (file) {
      const origin = `${req.protocol}://${req.get('host')}`;
      payload.photos = [`${origin}/uploads/devices/${file.filename}`];
    }

    try {
      return await this.devicesService.create(payload);
    } catch (err) {
      console.error('DEVICE_CREATE_ERROR', {
        user: req.user?.sub || req.user?.userId,
        body: payload,
        err,
      });
      throw err;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const userRole = req.user?.role;
    const userId = req.user?.userId || req.user?.sub;

    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT and ADMIN can view all devices');
    }

    return this.devicesService.findAll(page, limit, search, status, type, sortOrder);
  }

  @Get('assigned')
  @UseGuards(JwtAuthGuard)
  findAssigned(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('userId') userIdQuery?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const userRole = req.user?.role;
    const userId = req.user?.userId || req.user?.sub;
    // If an admin/IT wants to view devices for a specific consultant, they can pass userId query param
    return this.devicesService.findAssigned(
      userId,
      userRole,
      page,
      limit,
      search,
      userIdQuery,
      sortOrder,
    );
  }

  @Get('with-maintenance')
  @UseGuards(JwtAuthGuard)
  async getDevicesWithMaintenance(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = month !== undefined ? parseInt(month, 10) : undefined;
    const y = year !== undefined ? parseInt(year, 10) : undefined;
    return this.devicesService.findAllWithMaintenance(m, y);
  }

  @Get('without-maintenance')
  @UseGuards(JwtAuthGuard)
  async getDevicesWithoutMaintenance() {
    return this.devicesService.getDevicesWithoutMaintenance();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: any, @Param('id') id: string) {
    const userRole = req.user?.role;
    const userId = req.user?.userId || req.user?.sub;
    return this.devicesService.findOneForUser(userId, userRole, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateDeviceDto: any,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }

    return await this.devicesService.update(id, updateDeviceDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }
    return this.devicesService.updateStatus(id, { status: body.status as any });
  }

  @Patch(':id/allocate')
  @UseGuards(JwtAuthGuard)
  allocateDevice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { consultantId: string },
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }
    const assignedBy = req.user?.userId || req.user?.sub;
    return this.devicesService.allocateDevice(
      id,
      body.consultantId,
      assignedBy,
    );
  }

  @Patch(':id/return')
  @UseGuards(JwtAuthGuard)
  returnDevice(@Req() req: any, @Param('id') id: string) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }
    return this.devicesService.returnDevice(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can manage devices');
    }
    return this.devicesService.remove(id);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importDevices(@Req() req: any, @UploadedFile() file: any) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can import devices');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.devicesService.importDevices(file);
  }

  @Post(':id/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/devices';
          try {
            fs.mkdirSync(uploadPath, { recursive: true });
          } catch (e) {
            // ignore
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        const ext = extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
    ImageCompressionInterceptor,
  )
  async uploadPhoto(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can upload photos');
    }
    if (!file) {
      throw new BadRequestException('No photo uploaded');
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const publicPath = `${origin}/uploads/devices/${file.filename}`;
    return this.devicesService.addPhoto(id, publicPath);
  }

  @Post('export')
  @UseGuards(JwtAuthGuard)
  async exportDevices(
    @Req() req: any,
    @Body() body: { search?: string },
    @Res() res: Response,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can export devices');
    }
    const buffer = await this.devicesService.exportDevices(body?.search);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=appareils.xlsx');
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  }

  @Patch(':id/maintenance')
  @UseGuards(JwtAuthGuard)
  async updateDeviceMaintenance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { maintenanceDescription?: string; maintenanceEndDate?: string; maintenanceFrequency?: string },
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can update device maintenance');
    }
    return this.devicesService.updateMaintenance(id, body);
  }

  @Patch(':id/mark-maintained')
  @UseGuards(JwtAuthGuard)
  async markDeviceAsMaintained(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userRole = req.user?.role;
    if (userRole !== Role.IT && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only IT staff can mark devices as maintained');
    }
    return this.devicesService.markDeviceAsMaintained(id);
  }
}
