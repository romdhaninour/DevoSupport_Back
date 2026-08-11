import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../users/user.schema';
import { UsersService } from '../users/users.service';

const multerOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'chats'),
    filename: (req: any, file: any, cb: any) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req: any, file: any, cb: any) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      cb(new Error('Only image files are allowed'), false);
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async sendMessage(@Req() req: any, @Body() body: { receiverId: string; message: string; imageUrl?: string }) {
    const senderId = req.user?.userId || req.user?.sub;
    
    // Get sender and receiver roles for validation
    const sender = await this.usersService.findOne(senderId);
    const receiver = await this.usersService.findOne(body.receiverId);
    
    if (!sender || !receiver) {
      throw new Error('User not found');
    }
    
    return this.chatsService.createMessage(senderId, body.receiverId, body.message, sender.role, receiver.role, body.imageUrl);
  }

  @Get('conversations')
  async getConversations(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const userRole = req.user?.role;
    return this.chatsService.getConversationsForUser(userId, userRole);
  }

  @Get('conversation/:userId')
  async getConversation(@Param('userId') otherUserId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.chatsService.getConversation(userId, otherUserId);
  }

  @Get('unread')
  async getUnreadMessages(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.chatsService.getUnreadMessages(userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(@UploadedFile() file: any) {
    console.log('Upload request received:', file);
    if (!file) {
      console.error('No file uploaded');
      throw new Error('No file uploaded');
    }
    const url = `/uploads/chats/${file.filename}`;
    console.log('Generated URL:', url);
    return { url };
  }

  @Patch(':messageId/read')
  async markAsRead(@Param('messageId') messageId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.chatsService.markAsRead(messageId, userId);
  }

  @Patch('conversation/:senderId/read')
  async markConversationAsRead(@Param('senderId') senderId: string, @Req() req: any) {
    const receiverId = req.user?.userId || req.user?.sub;
    return this.chatsService.markConversationAsRead(senderId, receiverId);
  }

  @Post(':messageId/reactions')
  async addReaction(@Param('messageId') messageId: string, @Req() req: any, @Body() body: { emoji: string }) {
    const userId = req.user?.userId || req.user?.sub;
    return this.chatsService.addReaction(messageId, userId, body.emoji);
  }

  @Delete(':messageId/reactions/:emoji')
  async removeReaction(@Param('messageId') messageId: string, @Param('emoji') emoji: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.chatsService.addReaction(messageId, userId, decodeURIComponent(emoji));
  }
}
