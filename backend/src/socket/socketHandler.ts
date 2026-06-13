import { Server, Socket } from 'socket.io';
import { Session } from '../models/Session';
import { Participant } from '../models/Participant';
import { Message } from '../models/Message';
import { SessionEvent } from '../models/SessionEvent';
import { mediasoupManager } from '../services/mediasoupManager';

// Tracks timeouts for reconnecting participants: sessionId_role -> Timeout
const reconnectionTimers = new Map<string, NodeJS.Timeout>();
// Tracks active sockets: socketId -> data
const socketDataMap = new Map<string, {
  sessionId: string;
  sessionDbId: string;
  role: 'agent' | 'customer';
  name: string;
  participantDbId: string;
  transports: Set<string>;
  producers: Set<string>;
}>();

export const setupSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // JOIN SESSION
    socket.on('join-session', async (payload: { token: string; role: 'agent' | 'customer'; name: string }, callback: any) => {
      try {
        const { token, role, name } = payload;
        if (!token || !role || !name) {
          return callback({ error: 'Missing join parameters' });
        }

        const session = await Session.findOne({ token });
        if (!session) {
          return callback({ error: 'Session not found' });
        }

        if (session.status === 'completed') {
          return callback({ error: 'Session has already ended' });
        }

        const sessionId = session.token;
        const sessionDbId = session._id.toString();

        // Clear reconnection timer if it exists for this role in this session
        const timerKey = `${sessionId}_${role}`;
        if (reconnectionTimers.has(timerKey)) {
          clearTimeout(reconnectionTimers.get(timerKey)!);
          reconnectionTimers.delete(timerKey);
          console.log(`Reconnection successful for ${name} (${role}) within grace period`);
        }

        // If session was pending, make it active
        if (session.status === 'pending') {
          session.status = 'active';
          await session.save();
        }

        // Check for existing active participant record or create a new one
        let participant = await Participant.findOne({
          sessionId: session._id,
          role,
          leftAt: { $exists: false },
        });

        if (participant) {
          // If they re-joined or previous socket wasn't cleaned, update socket ID
          participant.socketId = socket.id;
          participant.joinedAt = new Date();
          await participant.save();
        } else {
          participant = new Participant({
            sessionId: session._id,
            role,
            name,
            socketId: socket.id,
            joinedAt: new Date(),
          });
          await participant.save();
        }

        // Track socket locally
        socketDataMap.set(socket.id, {
          sessionId,
          sessionDbId,
          role,
          name,
          participantDbId: participant._id.toString(),
          transports: new Set(),
          producers: new Set(),
        });

        // Join socket room
        socket.join(sessionId);

        // Save join event
        const logEvent = new SessionEvent({
          sessionId: session._id,
          eventType: 'join',
          details: `${name} (${role}) joined the session.`,
        });
        await logEvent.save();

        // Broadcast to others in the room
        socket.to(sessionId).emit('participant-joined', {
          socketId: socket.id,
          role,
          name,
          joinedAt: participant.joinedAt,
        });

        // Initialize Mediasoup router for this session
        const router = await mediasoupManager.getOrCreateRouter(sessionId);

        // Fetch existing producers in this session
        const existingProducers = mediasoupManager.getSessionProducers(sessionId);

        // Respond to joining client
        callback({
          success: true,
          sessionId,
          sessionDbId,
          role,
          name,
          rtpCapabilities: router.rtpCapabilities,
          existingProducers,
        });

      } catch (err: any) {
        console.error('Error joining session:', err);
        callback({ error: err.message || 'Server error during join' });
      }
    });

    // GET ROUTER CAPABILITIES
    socket.on('get-router-capabilities', async (callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        const router = await mediasoupManager.getOrCreateRouter(socketData.sessionId);
        callback({ rtpCapabilities: router.rtpCapabilities });
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    // CREATE WEBRTC TRANSPORT
    socket.on('create-webrtc-transport', async (payload: any, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        const { params } = await mediasoupManager.createTransport(socketData.sessionId);
        socketData.transports.add(params.id);
        callback({ params });
      } catch (err: any) {
        console.error('Create WebRtcTransport error:', err);
        callback({ error: err.message });
      }
    });

    // CONNECT WEBRTC TRANSPORT
    socket.on('connect-webrtc-transport', async (payload: { transportId: string; dtlsParameters: any }, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        await mediasoupManager.connectTransport(payload.transportId, payload.dtlsParameters);
        callback({ success: true });
      } catch (err: any) {
        console.error('Connect WebRtcTransport error:', err);
        callback({ error: err.message });
      }
    });

    // PRODUCE MEDIA
    socket.on('produce', async (payload: { transportId: string; kind: 'audio' | 'video'; rtpParameters: any }, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        const { transportId, kind, rtpParameters } = payload;
        const producer = await mediasoupManager.createProducer(
          socketData.sessionId,
          transportId,
          kind,
          rtpParameters
        );

        socketData.producers.add(producer.id);

        // Log produce event
        const logEvent = new SessionEvent({
          sessionId: socketData.sessionDbId,
          eventType: `produce_${kind}`,
          details: `${socketData.name} started sending ${kind} stream.`,
        });
        await logEvent.save();

        // Notify other peers in session
        socket.to(socketData.sessionId).emit('new-producer', {
          producerId: producer.id,
          socketId: socket.id,
          kind,
          role: socketData.role,
          name: socketData.name,
        });

        callback({ id: producer.id });
      } catch (err: any) {
        console.error('Produce error:', err);
        callback({ error: err.message });
      }
    });

    // CONSUME MEDIA
    socket.on('consume', async (payload: { transportId: string; producerId: string; rtpCapabilities: any }, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        const { transportId, producerId, rtpCapabilities } = payload;
        const { params } = await mediasoupManager.createConsumer(
          socketData.sessionId,
          transportId,
          producerId,
          rtpCapabilities
        );

        callback({ params });
      } catch (err: any) {
        console.error('Consume error:', err);
        callback({ error: err.message });
      }
    });

    // RESUME CONSUMER
    socket.on('resume-consumer', async (payload: { consumerId: string }, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      try {
        await mediasoupManager.resumeConsumer(payload.consumerId);
        callback({ success: true });
      } catch (err: any) {
        console.error('Resume consumer error:', err);
        callback({ error: err.message });
      }
    });

    // CLOSE PRODUCER
    socket.on('close-producer', async (payload: { producerId: string }) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return;

      mediasoupManager.closeProducer(socketData.sessionId, payload.producerId);
      socketData.producers.delete(payload.producerId);

      socket.to(socketData.sessionId).emit('producer-closed', {
        producerId: payload.producerId,
        socketId: socket.id,
      });
    });

    // SEND CHAT MESSAGE
    socket.on('send-message', async (payload: { content?: string; fileUrl?: string; fileName?: string; fileType?: string }, callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback?.({ error: 'Not joined in a session' });

      try {
        const { content, fileUrl, fileName, fileType } = payload;

        const message = new Message({
          sessionId: socketData.sessionDbId,
          senderRole: socketData.role,
          senderName: socketData.name,
          content: content || '',
          fileUrl,
          fileName,
          fileType,
        });

        await message.save();

        // Save log event if file sharing
        if (fileUrl) {
          const logEvent = new SessionEvent({
            sessionId: socketData.sessionDbId,
            eventType: 'file_share',
            details: `${socketData.name} shared file: ${fileName}`,
          });
          await logEvent.save();
        }

        // Broadcast message to all in room (including self so they receive Mongoose schema fields)
        io.to(socketData.sessionId).emit('new-message', message);

        if (callback) callback({ success: true, message });
      } catch (err: any) {
        console.error('Send message error:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // TOGGLE MEDIA STATUS (CAM ON/OFF, MIC MUTE/UNMUTE)
    socket.on('toggle-media', async (payload: { kind: 'audio' | 'video'; enabled: boolean }) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return;

      const { kind, enabled } = payload;

      // Log the event
      const logEvent = new SessionEvent({
        sessionId: socketData.sessionDbId,
        eventType: `${kind}_toggled`,
        details: `${socketData.name} toggled ${kind} ${enabled ? 'ON' : 'OFF'}.`,
      });
      await logEvent.save();

      // Notify others
      socket.to(socketData.sessionId).emit('media-toggled', {
        socketId: socket.id,
        role: socketData.role,
        kind,
        enabled,
      });
    });

    // AGENT ENDS THE SESSION
    socket.on('end-session', async (callback: any) => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return callback({ error: 'Not joined in a session' });

      if (socketData.role !== 'agent') {
        return callback({ error: 'Only agents can terminate the session' });
      }

      try {
        const session = await Session.findById(socketData.sessionDbId);
        if (session && session.status !== 'completed') {
          session.status = 'completed';
          session.completedAt = new Date();
          session.duration = Math.round((session.completedAt.getTime() - session.createdAt.getTime()) / 1000);
          await session.save();

          const logEvent = new SessionEvent({
            sessionId: session._id,
            eventType: 'session_ended',
            details: `Session completed. Ended by agent. Duration: ${session.duration}s`,
          });
          await logEvent.save();
        }

        // Broadcast ending notification
        io.to(socketData.sessionId).emit('session-ended', {
          duration: session?.duration || 0,
        });

        // Cleanup mediasoup assets
        mediasoupManager.closeSession(socketData.sessionId);

        callback({ success: true });
      } catch (err: any) {
        console.error('Error ending session:', err);
        callback({ error: err.message });
      }
    });

    // DISCONNECT / CONNECTION LOSS
    socket.on('disconnect', async () => {
      const socketData = socketDataMap.get(socket.id);
      if (!socketData) return;

      const { sessionId, sessionDbId, role, name, participantDbId, transports, producers } = socketData;
      console.log(`Socket disconnected for ${name} (${role}): ${socket.id}`);

      // Remove socket from the active socket map
      socketDataMap.delete(socket.id);

      // Start reconnection grace period (10 seconds)
      const timerKey = `${sessionId}_${role}`;
      const timer = setTimeout(async () => {
        try {
          console.log(`Grace period expired for ${name} (${role}). Cleaning up session resources.`);
          reconnectionTimers.delete(timerKey);

          // Update Participant record in MongoDB
          const participant = await Participant.findById(participantDbId);
          if (participant) {
            participant.leftAt = new Date();
            await participant.save();
          }

          // Log leave event
          const logEvent = new SessionEvent({
            sessionId: sessionDbId,
            eventType: 'leave',
            details: `${name} (${role}) disconnected and left the session.`,
          });
          await logEvent.save();

          // Close all client's WebRTC transports and producers on SFU
          producers.forEach((pId) => {
            mediasoupManager.closeProducer(sessionId, pId);
          });
          transports.forEach((tId) => {
            mediasoupManager.closeTransport(tId);
          });

          // Notify remaining participants in room
          io.to(sessionId).emit('participant-left', {
            socketId: socket.id,
            role,
            name,
          });

          // Check if session is empty. If no participants left, close mediasoup router.
          const activeParticipants = await Participant.countDocuments({
            sessionId: sessionDbId,
            leftAt: { $exists: false },
          });

          if (activeParticipants === 0) {
            console.log(`No active participants left in session ${sessionId}. Closing Mediasoup router.`);
            mediasoupManager.closeSession(sessionId);
          }

        } catch (err) {
          console.error('Error in disconnect cleanup timeout:', err);
        }
      }, 10000); // 10-second grace period

      reconnectionTimers.set(timerKey, timer);

      // Notify others immediately of temporary disconnect status
      socket.to(sessionId).emit('participant-disconnected-temporary', {
        socketId: socket.id,
        role,
        name,
      });
    });
  });
};
