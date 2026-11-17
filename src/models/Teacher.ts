import { Schema, model, InferSchemaType } from 'mongoose';

const teacherSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    experience: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export type TeacherDoc = InferSchemaType<typeof teacherSchema>;
export const Teacher = model('Teacher', teacherSchema);
