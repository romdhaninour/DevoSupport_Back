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
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      profilePicture: photos && photos.length > 0 ? photos[0].value : null,
    };

    const validatedUser = await this.authService.validateGoogleUser(user);
    const { access_token } = await this.authService.login(validatedUser);
    
    // Extract plain object from Mongoose document
    const plainUser = {
      _id: (validatedUser as any)._id,
      nom: validatedUser.nom,
      prenom: validatedUser.prenom,
      email: validatedUser.email,
      role: validatedUser.role,
      status: validatedUser.status,
      isConsultant: validatedUser.isConsultant,
      profilePicture: (validatedUser as any).profilePicture,
      token: access_token
    };
    
    done(null, plainUser);
  }
}
