import { Schema, model } from 'mongoose';

const SessionEventSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  eventType: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const SessionEvent = model('SessionEvent', SessionEventSchema);
