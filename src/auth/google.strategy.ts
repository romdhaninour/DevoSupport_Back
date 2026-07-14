import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;

    const userProfile = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      profilePicture: photos && photos.length > 0 ? photos[0].value : null,
    };

    const validation = await this.authService.validateGoogleUser(userProfile);

    if (validation.status === 'not_registered') {
      return done(null, false, { message: 'account_not_registered' });
    }

    if (validation.status === 'inactive') {
      return done(null, false, { message: 'account_inactive' });
    }

    const validatedUser = validation.user;
    const { access_token, userId } =
      await this.authService.login(validatedUser);

    const plainUser = {
      _id: (validatedUser as any)._id,
      nom: validatedUser.nom,
      prenom: validatedUser.prenom,
      email: validatedUser.email,
      role: validatedUser.role,
      status: validatedUser.status,
      isConsultant: validatedUser.isConsultant,
      profilePicture: (validatedUser as any).profilePicture,
      token: access_token,
      userId: userId,
    };

    done(null, plainUser);
  }
}
