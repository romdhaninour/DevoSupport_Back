import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  sender: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  receiver: Types.ObjectId;

  @Prop()
  message: string;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [{ emoji: String, userId: { type: Types.ObjectId, ref: 'User' } }], default: [] })
  reactions: { emoji: string; userId: Types.ObjectId }[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Index for faster queries
ChatSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
ChatSchema.index({ receiver: 1, read: 1 });
