import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User, Role } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(profile: any): Promise<User> {
    const { email, firstName, lastName, profilePicture } = profile;
    
    console.log('Google profile:', profile);
    console.log('Extracted email:', email);
    
    let user = await this.usersService.findByEmail(email);
    
    if (!user) {
      console.log('Creating new user with email:', email);
      // Create new user if doesn't exist
      user = await this.usersService.create({
        email,
        nom: lastName || '',
        prenom: firstName || '',
        role: Role.IT, // Default role for Google sign-up
        profilePicture: profilePicture || null,
      });
      console.log('User created:', user);
    } else {
      console.log('User already exists:', user);
      // Update profile picture if it's new or different
      if (profilePicture && (user as any).profilePicture !== profilePicture) {
        console.log('Updating profile picture for user:', email);
        await this.usersService.update((user as any)._id, { profilePicture });
        // Refresh user data after update
        const updatedUser = await this.usersService.findByEmail(email);
        if (updatedUser) {
          user = updatedUser;
        }
      }
    }
    
    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id || user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}
