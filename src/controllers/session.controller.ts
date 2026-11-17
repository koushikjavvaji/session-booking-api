import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import { assertObjectId, parseDate } from '../utils/validation';

export async function createSession(req: Request, res: Response) {
  const body = req.body ?? {};
  const teacherId = assertObjectId(body.teacherId, 'teacherId');
  const startTime = parseDate(body.startTime, 'startTime');
  const endTime = parseDate(body.endTime, 'endTime');
  const session = await sessionService.createSession({ teacherId, startTime, endTime });
  res.status(201).json({ success: true, data: session });
}

export async function getAvailableSessions(req: Request, res: Response) {
  const date = parseDate(req.query.dateTimestamp, 'dateTimestamp');
  const sessions = await sessionService.getAvailableSessions(date);
  res.status(200).json({ success: true, count: sessions.length, data: sessions });
}

export async function bookSession(req: Request, res: Response) {
  const sessionId = assertObjectId(req.params.id, 'session id');
  const userId = assertObjectId((req.body ?? {}).userId, 'userId');
  const session = await sessionService.bookSession(sessionId, userId);
  res.status(200).json({ success: true, data: session });
}

export async function completeSession(req: Request, res: Response) {
  const sessionId = assertObjectId(req.params.id, 'session id');
  const session = await sessionService.completeSession(sessionId);
  res.status(200).json({ success: true, data: session });
}
