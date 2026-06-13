import { Router } from 'express';
import {
  createSession,
  verifySession,
  getActiveSessions,
  getSessionHistory,
  getSessionDetails,
  updateSessionNotes,
  submitSessionRating,
  endSession,
  adminGetActiveSessions,
  adminTerminateSession,
} from '../controllers/sessionController';
import { authenticateAgent } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/verify/:token', verifySession as any);
router.post('/:token/rating', submitSessionRating as any);

// Authenticated agent routes
router.post('/', authenticateAgent as any, createSession as any);
router.get('/active', authenticateAgent as any, getActiveSessions as any);
router.get('/history', authenticateAgent as any, getSessionHistory as any);
router.get('/details/:token', authenticateAgent as any, getSessionDetails as any);
router.post('/:token/end', authenticateAgent as any, endSession as any);
router.put('/:token/notes', authenticateAgent as any, updateSessionNotes as any);

// Admin dashboard routes (also secured for agents)
router.get('/admin/active', authenticateAgent as any, adminGetActiveSessions as any);
router.post('/admin/terminate/:token', authenticateAgent as any, adminTerminateSession as any);

export default router;
