import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { authenticateAgent } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateAgent as any, me as any);

export default router;
