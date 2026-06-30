import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

interface AuthRequest extends Request {
  user?: any;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Initiates the Google OAuth2 login flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleLoginCallback(@Req() req: AuthRequest, @Res() res: Response) {
    console.log('Google callback req.user:', req.user);
    const { token, status, role, profilePicture, nom, prenom, email } = req.user;
    console.log('Extracted values:', { token, status, role, profilePicture });
    res.redirect(`http://localhost:4200/auth/callback?token=${token}&status=${status}&role=${role}&profilePicture=${encodeURIComponent(profilePicture || '')}&nom=${encodeURIComponent(nom || '')}&prenom=${encodeURIComponent(prenom || '')}&email=${encodeURIComponent(email || '')}`);
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: AuthRequest) {
    return req.user;
  }
}
