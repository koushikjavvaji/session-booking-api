import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as users from '../controllers/user.controller';
import * as teachers from '../controllers/teacher.controller';
import * as sessions from '../controllers/session.controller';

export const router = Router();

router.post('/users', asyncHandler(users.createUser));
router.get('/users/:id/sessions', asyncHandler(users.getUserSessions));

router.post('/teachers', asyncHandler(teachers.createTeacher));

router.post('/sessions', asyncHandler(sessions.createSession));
router.get('/sessions/available', asyncHandler(sessions.getAvailableSessions));
router.post('/sessions/:id/book', asyncHandler(sessions.bookSession));
router.patch('/sessions/:id/complete', asyncHandler(sessions.completeSession));
