import { Types } from 'mongoose';
import { User } from '../models/User';
import { Session, SESSION_STATUS } from '../models/Session';
import { ApiError } from '../utils/ApiError';

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
}

export async function createUser(input: CreateUserInput) {
  const existing = await User.exists({ email: input.email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('A user with this email already exists');
  }
  return User.create(input);
}

const teacherLookup = [
  {
    $lookup: {
      from: 'teachers',
      localField: 'teacherId',
      foreignField: '_id',
      as: 'teacher',
      pipeline: [{ $project: { fullName: 1, email: 1, specialization: 1, experience: 1 } }],
    },
  },
  { $unwind: '$teacher' },
  { $project: { teacherId: 0, __v: 0 } },
];

/**
 * Sessions of a user split into upcoming (booked, not yet completed) and completed,
 * built with a single aggregation pipeline using $facet.
 */
export async function getUserSessions(userId: Types.ObjectId) {
  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw ApiError.notFound('User not found');
  }

  const [result] = await Session.aggregate<{
    upcomingSessions: unknown[];
    completedSessions: unknown[];
  }>([
    { $match: { userId, status: { $in: [SESSION_STATUS.BOOKED, SESSION_STATUS.COMPLETED] } } },
    {
      $facet: {
        upcomingSessions: [
          { $match: { status: SESSION_STATUS.BOOKED } },
          { $sort: { startTime: 1 } },
          ...teacherLookup,
        ],
        completedSessions: [
          { $match: { status: SESSION_STATUS.COMPLETED } },
          { $sort: { completedAt: -1 } },
          ...teacherLookup,
        ],
      },
    },
  ]);

  return {
    upcomingSessions: result?.upcomingSessions ?? [],
    completedSessions: result?.completedSessions ?? [],
  };
}
