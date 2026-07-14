import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum IssueType {
  DAMAGED = 'damaged',
  DESTROYED = 'destroyed',
  MALFUNCTION = 'malfunction',
  OTHER = 'other',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ResolutionType {
  REPAIR = 'repair',
  REPLACE = 'replace',
}

export interface Comment {
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Ticket extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Device' })
  device: Types.ObjectId;

  @Prop({ required: true, enum: IssueType })
  issueType: IssueType;

  @Prop({ required: true, enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Prop({ required: true, enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Prop({ enum: ResolutionType, nullable: true })
  resolution: ResolutionType;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', nullable: true })
  assignedTo: Types.ObjectId;

  @Prop({ type: [{ author: { type: Types.ObjectId, ref: 'User' }, text: String, createdAt: Date }] })
  comments: Comment[];

  @Prop({ type: Date, nullable: true })
  resolvedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
