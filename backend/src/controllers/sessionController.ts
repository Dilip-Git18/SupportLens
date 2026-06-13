import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { Session } from '../models/Session';
import { Participant } from '../models/Participant';
import { Message } from '../models/Message';
import { SessionEvent } from '../models/SessionEvent';
import { AuthRequest } from '../middleware/auth';

// Create a support session
export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const { customerName, category } = req.body;
    if (!customerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = uuidv4();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/session/${token}`;

    // Generate QR Code
    let qrCodeUrl = '';
    try {
      qrCodeUrl = await QRCode.toDataURL(inviteUrl);
    } catch (qrErr) {
      console.error('Error generating QR code:', qrErr);
    }

    const session = new Session({
      token,
      agentId: req.user.id,
      customerName,
      category: category || 'General',
      status: 'pending',
    });

    await session.save();

    // Create a system event log
    const event = new SessionEvent({
      sessionId: session._id,
      eventType: 'session_created',
      details: `Session created by Agent ${req.user.name} for Customer ${customerName}`,
    });
    await event.save();

    return res.status(201).json({
      session,
      inviteUrl,
      qrCodeUrl,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Verify session invite token
export const verifySession = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ token }).populate('agentId', 'name email');
    if (!session) {
      return res.status(404).json({ message: 'Invalid or expired invite link' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ message: 'This support session has already ended', session });
    }

    return res.json({ session });
  } catch (error) {
    console.error('Error verifying session:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get active sessions for logged-in Agent
export const getActiveSessions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sessions = await Session.find({
      agentId: req.user.id,
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    return res.json(sessions);
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get completed sessions for Agent history
export const getSessionHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sessions = await Session.find({
      agentId: req.user.id,
      status: 'completed',
    }).sort({ completedAt: -1 });

    return res.json(sessions);
  } catch (error) {
    console.error('Error getting session history:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get detailed session information (participants, chat history, events)
export const getSessionDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ token }).populate('agentId', 'name email');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify ownership
    if (req.user && session.agentId._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const participants = await Participant.find({ sessionId: session._id }).sort({ joinedAt: 1 });
    const messages = await Message.find({ sessionId: session._id }).sort({ timestamp: 1 });
    const events = await SessionEvent.find({ sessionId: session._id }).sort({ timestamp: 1 });

    return res.json({
      session,
      participants,
      messages,
      events,
    });
  } catch (error) {
    console.error('Error getting session details:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Update notes and category (Agent only)
export const updateSessionNotes = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const { notes, category } = req.body;

    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (notes !== undefined) session.notes = notes;
    if (category !== undefined) session.category = category;

    await session.save();

    // Log the notes update event
    const event = new SessionEvent({
      sessionId: session._id,
      eventType: 'notes_updated',
      details: `Session notes/category updated by Agent`,
    });
    await event.save();

    return res.json(session);
  } catch (error) {
    console.error('Error updating session notes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Submit rating (Customer only - can be public/customer verified via session token)
export const submitSessionRating = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const { rating, ratingFeedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5 stars' });
    }

    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.rating = rating;
    session.ratingFeedback = ratingFeedback || '';
    await session.save();

    const event = new SessionEvent({
      sessionId: session._id,
      eventType: 'rating_submitted',
      details: `Customer submitted feedback: ${rating} stars. ${ratingFeedback ? `Feedback: "${ratingFeedback}"` : ''}`,
    });
    await event.save();

    return res.json(session);
  } catch (error) {
    console.error('Error submitting rating:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// End a session (Agent only)
export const endSession = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.json(session);
    }

    session.status = 'completed';
    session.completedAt = new Date();
    
    // Calculate duration in seconds
    const start = session.createdAt.getTime();
    const end = session.completedAt.getTime();
    session.duration = Math.round((end - start) / 1000);

    await session.save();

    const event = new SessionEvent({
      sessionId: session._id,
      eventType: 'session_ended',
      details: `Session ended successfully. Duration: ${session.duration} seconds`,
    });
    await event.save();

    return res.json(session);
  } catch (error) {
    console.error('Error ending session:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get all active sessions across all agents
export const adminGetActiveSessions = async (req: AuthRequest, res: Response) => {
  try {
    // Note: Any valid authenticated agent acts as an admin in this hackathon setup
    const sessions = await Session.find({
      status: { $in: ['pending', 'active'] },
    }).populate('agentId', 'name email').sort({ createdAt: -1 });

    // For each session, fetch participant count
    const sessionsWithStats = await Promise.all(
      sessions.map(async (sess) => {
        const participantCount = await Participant.countDocuments({
          sessionId: sess._id,
          leftAt: { $exists: false },
        });
        return {
          ...sess.toObject(),
          activeParticipantCount: participantCount,
        };
      })
    );

    return res.json(sessionsWithStats);
  } catch (error) {
    console.error('Error admin getting active sessions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Terminate any active session
export const adminTerminateSession = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.status = 'completed';
    session.completedAt = new Date();
    
    const start = session.createdAt.getTime();
    const end = session.completedAt.getTime();
    session.duration = Math.round((end - start) / 1000);

    await session.save();

    const event = new SessionEvent({
      sessionId: session._id,
      eventType: 'session_terminated_by_admin',
      details: 'Session terminated forcefully by Admin/Agent dashboard',
    });
    await event.save();

    return res.json(session);
  } catch (error) {
    console.error('Error terminating session:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
