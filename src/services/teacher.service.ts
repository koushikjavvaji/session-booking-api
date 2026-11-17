import { Teacher } from '../models/Teacher';
import { ApiError } from '../utils/ApiError';

export interface CreateTeacherInput {
  fullName: string;
  email: string;
  specialization: string;
  experience: number;
}

export async function createTeacher(input: CreateTeacherInput) {
  const existing = await Teacher.exists({ email: input.email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('A teacher with this email already exists');
  }
  return Teacher.create(input);
}
