import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
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

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const corsOptions = {
  origin: frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/upload', uploadRoutes);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'SupportLens backend is running' });
});

// Configure Socket.IO
const io = new Server(server, {
  cors: corsOptions,
});

// Initialize Socket.IO connection handling
setupSocket(io);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ message: err.message || 'An internal server error occurred' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();

    // Seed default agent if not exists
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

    // 2. Initialize Mediasoup workers
    await mediasoupManager.initialize();

    // 3. Start HTTP server
    server.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(`  SupportLens Server running on port ${PORT}`);
      console.log(`  Frontend URL: ${frontendUrl}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===================================================`);
    });
  } catch (error) {
    console.error('Failed to start SupportLens Server:', error);
    process.exit(1);
  }
};

startServer();
