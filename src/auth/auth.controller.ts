import {
  Controller,
  ExecutionContext,
  Get,
  Redirect,
  Req,
  UseGuards,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
class GoogleAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      session: false,
    });
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err) {
      throw err;
    }

    return user;
  }
}

interface AuthRequest extends Request {
  user?: any;
}

@Controller('auth')
export class AuthController {
  private frontendUrl: string;

  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Initiates the Google OAuth2 login flow
  }

   @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @Redirect()
  googleLoginCallback(@Req() req: AuthRequest) {
    if (!req.user || !req.user.token) {
      return {
        url: `${this.frontendUrl}/signin?message=account_not_registered`,
      };
    }

    const { token, status, role, profilePicture, nom, prenom, email, userId } =
      req.user;

    return {
      url: `${this.frontendUrl}/auth/callback?token=${token}&status=${status}&role=${role}&profilePicture=${encodeURIComponent(profilePicture || '')}&nom=${encodeURIComponent(nom || '')}&prenom=${encodeURIComponent(prenom || '')}&email=${encodeURIComponent(email || '')}&userId=${encodeURIComponent(userId || '')}`,
    };
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: AuthRequest) {
    return req.user;
  }
}
