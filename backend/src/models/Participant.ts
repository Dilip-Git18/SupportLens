import { Schema, model } from 'mongoose';

const ParticipantSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  role: { type: String, enum: ['agent', 'customer'], required: true },
  name: { type: String, required: true },
  socketId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
});

export const Participant = model('Participant', ParticipantSchema);
