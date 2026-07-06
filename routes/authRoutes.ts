import { Router } from 'express';
import { login, register, getMe, getToken } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
const router = Router();
router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getMe);
router.get('/token', getToken);
export default router;
