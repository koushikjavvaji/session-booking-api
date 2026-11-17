import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { assertObjectId, requireString } from '../utils/validation';
import { ApiError } from '../utils/ApiError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(req: Request, res: Response) {
  const body = req.body ?? {};
  const fullName = requireString(body, 'fullName');
  const email = requireString(body, 'email');
  const phone = requireString(body, 'phone');
  if (!EMAIL_RE.test(email)) {
    throw ApiError.badRequest('email must be a valid email address');
  }
  const user = await userService.createUser({ fullName, email, phone });
  res.status(201).json({ success: true, data: user });
}

export async function getUserSessions(req: Request, res: Response) {
  const userId = assertObjectId(req.params.id, 'user id');
  const sessions = await userService.getUserSessions(userId);
  res.status(200).json({ success: true, data: sessions });
}
