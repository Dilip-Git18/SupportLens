import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

import { connectDB } from './config/db';
import { mediasoupManager } from './services/mediasoupManager';
import { setupSocket } from './socket/socketHandler';

import authRoutes from './routes/authRoutes';
import sessionRoutes from './routes/sessionRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { User } from './models/User';

const app = express();
const server = http.createServer(app);

// ✅ FIX 1: Allow multiple origins (important for Render + frontend)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// ✅ FIX 2: Root route (fixes "Cannot GET /")
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SupportLens API is running 🚀',
    health: '/health',
    version: '1.0.0'
  });
});

// Upload directory
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SupportLens backend is running'
  });
});

// Socket.IO
const io = new Server(server, {
  cors: corsOptions,
});

setupSocket(io);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Seed demo agent
    const defaultEmail = 'agent@supportlens.com';
    const existingAgent = await User.findOne({ email: defaultEmail });

    if (!existingAgent) {
      const demoAgent = new User({
        name: 'Demo Support Agent',
        email: defaultEmail,
        password: 'Password123!',
      });
      await demoAgent.save();

      console.log('===================================================');
      console.log('  Seeded Default Agent Credentials:');
      console.log('  Email: agent@supportlens.com');
      console.log('  Password: Password123!');
      console.log('===================================================');
    }

    await mediasoupManager.initialize();

    server.listen(PORT, () => {
      console.log('===================================================');
      console.log(`  SupportLens Server running on port ${PORT}`);
      console.log(`  Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('===================================================');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();