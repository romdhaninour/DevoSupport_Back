import { Controller, Get, Post, Body, Param, Req, Patch, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../users/user.schema';
import { UsersService } from '../users/users.service';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async sendMessage(@Req() req: any, @Body() body: { receiverId: string; message: string }) {
    const senderId = req.user?.userId || req.user?.sub;
    
    // Get sender and receiver roles for validation
    const sender = await this.usersService.findOne(senderId);
    const receiver = await this.usersService.findOne(body.receiverId);
    
    if (!sender || !receiver) {
      throw new Error('User not found');
    }
    
    return this.chatsService.createMessage(senderId, body.receiverId, body.message, sender.role, receiver.role);
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
}
