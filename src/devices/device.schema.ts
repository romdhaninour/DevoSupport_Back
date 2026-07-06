import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

export type DeviceStatus = 'available' | 'assigned' | 'maintenance' | 'retired';
export type DeviceType = 'Laptop' | 'Desktop' | 'Mobile' | 'Tablet' | 'Printer' | 'Scanner' | 'Monitor' | 'Router' | 'Switch' | 'Access Point' | 'Camera' | 'Projecteur';

@Schema({ timestamps: true })
export class Device {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  type!: DeviceType;

  @Prop({ trim: true })
  department!: string;

  @Prop({ trim: true })
  owner!: string;

  @Prop({ trim: true })
  email!: string;

  @Prop({ required: true, enum: ['available', 'assigned', 'maintenance', 'retired'], default: 'available' })
  status!: DeviceStatus;

  @Prop({ trim: true })
  location!: string;

  @Prop({ trim: true, unique: true, sparse: true })
  serialNumber!: string;

  @Prop({ trim: true })
  purchaseDate!: string;

  @Prop({ type: String, default: null })
  assignedTo!: string | null;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ type: String, default: null })
  assignedBy!: string | null;

  @Prop({ type: [String], default: [] })
  photos!: string[];
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
