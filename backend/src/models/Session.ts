import { Schema, model, Types } from 'mongoose';

const SessionSchema = new Schema({
  token: { type: String, required: true, unique: true, index: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed'], 
    default: 'pending' 
  },
  category: { type: String, default: 'General' },
  notes: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5 },
  ratingFeedback: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  duration: { type: Number, default: 0 }, // in seconds
});

export const Session = model('Session', SessionSchema);
