import { Types } from 'mongoose';
import { ApiError } from './ApiError';

export function assertObjectId(value: unknown, field: string): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`${field} must be a valid id`);
  }
  return new Types.ObjectId(value);
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw ApiError.badRequest(`${field} is required`);
  }
  return value.trim();
}

export function parseDate(value: unknown, field: string): Date {
  if (value === undefined || value === null || value === '') {
    throw ApiError.badRequest(`${field} is required`);
  }
  const date = typeof value === 'number' || /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} must be a valid date or timestamp`);
  }
  return date;
}
