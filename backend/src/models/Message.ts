import { Schema, model } from 'mongoose';

const MessageSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  senderRole: { type: String, enum: ['agent', 'customer'], required: true },
  senderName: { type: String, required: true },
  content: { type: String, default: '' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export const Message = model('Message', MessageSchema);
