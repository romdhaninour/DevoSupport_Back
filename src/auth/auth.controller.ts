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
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Initiates the Google OAuth2 login flow
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @Redirect()
  googleLoginCallback(@Req() req: AuthRequest) {
    console.log('Google callback req.user:', req.user);
    if (!req.user || !req.user.token) {
      return {
        url: 'http://localhost:4200/signin?message=account_not_registered',
      };
    }

    const { token, status, role, profilePicture, nom, prenom, email, userId } =
      req.user;
    console.log('Extracted values:', { token, status, role, profilePicture });

    return {
      url: `http://localhost:4200/auth/callback?token=${token}&status=${status}&role=${role}&profilePicture=${encodeURIComponent(profilePicture || '')}&nom=${encodeURIComponent(nom || '')}&prenom=${encodeURIComponent(prenom || '')}&email=${encodeURIComponent(email || '')}&userId=${encodeURIComponent(userId || '')}`,
    };
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: AuthRequest) {
    return req.user;
  }
}
