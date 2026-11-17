import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';

const app = createApp();
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const day = Date.UTC(2026, 11, 1); // 1 Dec 2026, 00:00 UTC
const at = (hours: number) => new Date(day + hours * 3600_000).toISOString();

async function makeUser(email = 'asha@example.com') {
  const res = await request(app).post('/users').send({ fullName: 'Asha Rao', email, phone: '9876543210' });
  return res.body.data._id as string;
}

async function makeTeacher() {
  const res = await request(app)
    .post('/teachers')
    .send({ fullName: 'Ravi Kumar', email: 'ravi@example.com', specialization: 'Spoken English', experience: 5 });
  return res.body.data._id as string;
}

async function makeSession(teacherId: string, startH = 10, endH = 11) {
  const res = await request(app).post('/sessions').send({ teacherId, startTime: at(startH), endTime: at(endH) });
  return res.body.data._id as string;
}

describe('POST /users', () => {
  it('creates a user', async () => {
    const res = await request(app).post('/users').send({ fullName: 'Asha Rao', email: 'ASHA@example.com', phone: '9876543210' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('asha@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await makeUser();
    const res = await request(app).post('/users').send({ fullName: 'Other', email: 'asha@example.com', phone: '1' });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/users').send({ email: 'x@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /sessions', () => {
  it('creates an AVAILABLE session', async () => {
    const teacherId = await makeTeacher();
    const res = await request(app).post('/sessions').send({ teacherId, startTime: at(10), endTime: at(11) });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('AVAILABLE');
    expect(res.body.data.userId).toBeNull();
  });

  it('rejects endTime <= startTime', async () => {
    const teacherId = await makeTeacher();
    const res = await request(app).post('/sessions').send({ teacherId, startTime: at(11), endTime: at(10) });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown teacher', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ teacherId: new mongoose.Types.ObjectId().toString(), startTime: at(10), endTime: at(11) });
    expect(res.status).toBe(404);
  });
});

describe('GET /sessions/available', () => {
  it('returns only AVAILABLE sessions for the given date, with teacher details', async () => {
    const teacherId = await makeTeacher();
    const userId = await makeUser();
    const s1 = await makeSession(teacherId, 9, 10);
    const s2 = await makeSession(teacherId, 14, 15);
    await makeSession(teacherId, 30, 31); // next day
    await request(app).post(`/sessions/${s2}/book`).send({ userId });

    const res = await request(app).get('/sessions/available').query({ dateTimestamp: day + 5 * 3600_000 });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]._id).toBe(s1);
    expect(res.body.data[0].teacher.fullName).toBe('Ravi Kumar');
  });

  it('requires a valid dateTimestamp', async () => {
    const res = await request(app).get('/sessions/available').query({ dateTimestamp: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('POST /sessions/:id/book', () => {
  it('books an AVAILABLE session and rejects a second booking', async () => {
    const teacherId = await makeTeacher();
    const userId = await makeUser();
    const sessionId = await makeSession(teacherId);

    const first = await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('BOOKED');
    expect(first.body.data.userId).toBe(userId);

    const second = await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    expect(second.status).toBe(409);
  });

  it('allows only one of two concurrent bookings', async () => {
    const teacherId = await makeTeacher();
    const u1 = await makeUser('a@example.com');
    const u2 = await makeUser('b@example.com');
    const sessionId = await makeSession(teacherId);
    const results = await Promise.all([
      request(app).post(`/sessions/${sessionId}/book`).send({ userId: u1 }),
      request(app).post(`/sessions/${sessionId}/book`).send({ userId: u2 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('returns 404 for unknown user or session', async () => {
    const teacherId = await makeTeacher();
    const userId = await makeUser();
    const sessionId = await makeSession(teacherId);
    const fakeId = new mongoose.Types.ObjectId().toString();
    expect((await request(app).post(`/sessions/${sessionId}/book`).send({ userId: fakeId })).status).toBe(404);
    expect((await request(app).post(`/sessions/${fakeId}/book`).send({ userId })).status).toBe(404);
  });
});

describe('PATCH /sessions/:id/complete', () => {
  it('completes a BOOKED session and sets completedAt', async () => {
    const teacherId = await makeTeacher();
    const userId = await makeUser();
    const sessionId = await makeSession(teacherId);
    await request(app).post(`/sessions/${sessionId}/book`).send({ userId });

    const res = await request(app).patch(`/sessions/${sessionId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.completedAt).toBeTruthy();
  });

  it('rejects completing a session that is not BOOKED', async () => {
    const teacherId = await makeTeacher();
    const sessionId = await makeSession(teacherId);
    const res = await request(app).patch(`/sessions/${sessionId}/complete`);
    expect(res.status).toBe(409);
  });
});

describe('GET /users/:id/sessions', () => {
  it('splits sessions into upcoming and completed', async () => {
    const teacherId = await makeTeacher();
    const userId = await makeUser();
    const booked = await makeSession(teacherId, 10, 11);
    const done = await makeSession(teacherId, 12, 13);
    await makeSession(teacherId, 14, 15); // never booked, must not appear
    await request(app).post(`/sessions/${booked}/book`).send({ userId });
    await request(app).post(`/sessions/${done}/book`).send({ userId });
    await request(app).patch(`/sessions/${done}/complete`);

    const res = await request(app).get(`/users/${userId}/sessions`);
    expect(res.status).toBe(200);
    expect(res.body.data.upcomingSessions.map((s: { _id: string }) => s._id)).toEqual([booked]);
    expect(res.body.data.completedSessions.map((s: { _id: string }) => s._id)).toEqual([done]);
    expect(res.body.data.completedSessions[0].teacher.specialization).toBe('Spoken English');
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request(app).get(`/users/${new mongoose.Types.ObjectId().toString()}/sessions`);
    expect(res.status).toBe(404);
  });
});
