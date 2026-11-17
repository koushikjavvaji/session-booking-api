import { Request, Response } from 'express';
import * as teacherService from '../services/teacher.service';
import { requireString } from '../utils/validation';
import { ApiError } from '../utils/ApiError';

export async function createTeacher(req: Request, res: Response) {
  const body = req.body ?? {};
  const fullName = requireString(body, 'fullName');
  const email = requireString(body, 'email');
  const specialization = requireString(body, 'specialization');
  const experience = Number(body.experience);
  if (body.experience === undefined || Number.isNaN(experience) || experience < 0) {
    throw ApiError.badRequest('experience must be a non-negative number');
  }
  const teacher = await teacherService.createTeacher({ fullName, email, specialization, experience });
  res.status(201).json({ success: true, data: teacher });
}
