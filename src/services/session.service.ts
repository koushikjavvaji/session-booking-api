import { Types } from 'mongoose';
import { Session, SESSION_STATUS } from '../models/Session';
import { Teacher } from '../models/Teacher';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';

export interface CreateSessionInput {
  teacherId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
}

export async function createSession(input: CreateSessionInput) {
  if (input.endTime.getTime() <= input.startTime.getTime()) {
    throw ApiError.badRequest('endTime must be greater than startTime');
  }
  const teacherExists = await Teacher.exists({ _id: input.teacherId });
  if (!teacherExists) {
    throw ApiError.notFound('Teacher not found');
  }
  return Session.create({ ...input, status: SESSION_STATUS.AVAILABLE });
}

/** Start (inclusive) and end (exclusive) of the UTC calendar day containing `date`. */
export function utcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** All AVAILABLE sessions starting on the given (UTC) day, via an aggregation pipeline. */
export async function getAvailableSessions(date: Date) {
  const { start, end } = utcDayRange(date);
  return Session.aggregate([
    {
      $match: {
        status: SESSION_STATUS.AVAILABLE,
        startTime: { $gte: start, $lt: end },
      },
    },
    { $sort: { startTime: 1 } },
    {
      $lookup: {
        from: 'teachers',
        localField: 'teacherId',
        foreignField: '_id',
        as: 'teacher',
        pipeline: [{ $project: { fullName: 1, specialization: 1, experience: 1 } }],
      },
    },
    { $unwind: '$teacher' },
    {
      $project: {
        _id: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        durationMinutes: { $divide: [{ $subtract: ['$endTime', '$startTime'] }, 60000] },
        teacher: 1,
      },
    },
  ]);
}

export async function bookSession(sessionId: Types.ObjectId, userId: Types.ObjectId) {
  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw ApiError.notFound('User not found');
  }

  // Atomic conditional update: only an AVAILABLE session can move to BOOKED, so two
  // concurrent requests can never both book the same session.
  const booked = await Session.findOneAndUpdate(
    { _id: sessionId, status: SESSION_STATUS.AVAILABLE },
    { $set: { status: SESSION_STATUS.BOOKED, userId } },
    { new: true },
  );
  if (booked) {
    return booked;
  }

  const session = await Session.findById(sessionId).select('status');
  if (!session) {
    throw ApiError.notFound('Session not found');
  }
  if (session.status === SESSION_STATUS.BOOKED) {
    throw ApiError.conflict('Session is already booked');
  }
  throw ApiError.conflict(`Only AVAILABLE sessions can be booked (current status: ${session.status})`);
}

export async function completeSession(sessionId: Types.ObjectId) {
  const completed = await Session.findOneAndUpdate(
    { _id: sessionId, status: SESSION_STATUS.BOOKED },
    { $set: { status: SESSION_STATUS.COMPLETED, completedAt: new Date() } },
    { new: true },
  );
  if (completed) {
    return completed;
  }

  const session = await Session.findById(sessionId).select('status');
  if (!session) {
    throw ApiError.notFound('Session not found');
  }
  throw ApiError.conflict(`Only BOOKED sessions can be marked as completed (current status: ${session.status})`);
}
