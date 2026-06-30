import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum Role {
  ADMIN = 'ADMIN',
  IT = 'IT',
  CONSULTANT = 'CONSULTANT',
}

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  nom: string;

  @Prop({ required: true, trim: true })
  prenom: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String })
  profilePicture: string;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop({ type: String, enum: Status, default: Status.INACTIVE })
  status: Status;

  // IT is a sub-role of CONSULTANT
  // When role is IT, isConsultant is automatically true
  @Prop({ type: Boolean, default: false })
  isConsultant: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Auto-set isConsultant for IT and CONSULTANT roles
UserSchema.pre('save', function (next) {
  if (this.role === Role.IT || this.role === Role.CONSULTANT) {
    this.isConsultant = true;
  } else {
    this.isConsultant = false;
  }
  next;
});
