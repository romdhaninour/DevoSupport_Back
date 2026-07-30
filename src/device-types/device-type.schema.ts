import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceTypeDocument = DeviceTypeEntry & Document;

@Schema({ timestamps: true })
export class DeviceTypeEntry {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  description!: string;
}

export const DeviceTypeSchema = SchemaFactory.createForClass(DeviceTypeEntry);
