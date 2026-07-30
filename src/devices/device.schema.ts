import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

export type DeviceStatus = 'available' | 'assigned' | 'maintenance' | 'retired';
export type DeviceType =
  | 'Laptop'
  | 'Desktop'
  | 'Mobile'
  | 'Tablet'
  | 'Printer'
  | 'Scanner'
  | 'Monitor'
  | 'Router'
  | 'Switch'
  | 'Access Point'
  | 'Camera'
  | 'Projecteur';

export type MaintenanceFrequency =
  | '1month'
  | '3months'
  | '6months'
  | '9months'
  | '1year';

export const MaintenanceFrequencyLabels: Record<MaintenanceFrequency, string> = {
  '1month': '1 mois',
  '3months': '3 mois',
  '6months': '6 mois',
  '9months': '9 mois',
  '1year': '1 an',
};



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

  @Prop({
    required: true,
    enum: ['available', 'assigned', 'maintenance', 'retired'],
    default: 'available',
  })
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

  // Maintenance fields
  @Prop({ type: Boolean, default: false })
  maintenanceEnabled!: boolean;

  @Prop({ type: String, default: null })
  maintenanceDescription!: string | null;

  @Prop({ type: Date, default: null })
  maintenanceStartDate!: Date | null;

  @Prop({ type: Date, default: null })
  maintenanceEndDate!: Date | null;

  @Prop({ type: String, enum: ['1month', '3months', '6months', '9months', '1year'], default: null })
  maintenanceFrequency!: MaintenanceFrequency | null;

  @Prop({ type: Date, default: null })
  lastMaintenanceDate!: Date | null;

  @Prop({ type: Date, default: null })
  nextMaintenanceDate!: Date | null;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

DeviceSchema.index({ maintenanceEnabled: 1, nextMaintenanceDate: 1 });
