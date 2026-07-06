import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User, Role, Status } from '../users/user.schema';

export type GoogleValidateResult =
  | { status: 'registered'; user: User }
  | { status: 'inactive'; user: User }
  | { status: 'not_registered' };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(profile: any): Promise<GoogleValidateResult> {
    const { email, firstName, lastName, profilePicture } = profile;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail) {
      return { status: 'not_registered' };
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      return { status: 'not_registered' };
    }

    if (user.status !== Status.ACTIVE) {
      return { status: 'inactive', user };
    }

    // Always update profile picture if provided
    if (profilePicture) {
      await this.usersService.update((user as any)._id, { profilePicture });
      const updatedUser = await this.usersService.findByEmail(normalizedEmail);
      return { status: 'registered', user: updatedUser! };
    }

    return { status: 'registered', user };
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user._id || user.id,
      role: user.role,
      status: user.status,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user,
      userId: user._id || user.id,
    };
  }
}
