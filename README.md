# Session Booking API

REST API for a platform where users book sessions with teachers. Teachers publish available
sessions, users book them, and completed sessions show up in the user's history.

**Stack:** Node.js, TypeScript, Express.js, MongoDB, Mongoose.

## Setup

Requirements: Node.js 18+ and a MongoDB instance (local or Atlas).

```bash
git clone https://github.com/koushikjavvaji/session-booking-api.git
cd session-booking-api
npm install
cp .env.example .env        # then set MONGODB_URI
npm run dev                 # starts on http://localhost:3000 with reload
```

Production build:

```bash
npm run build
npm start
```

### Environment variables

| Variable      | Description                       | Example                                         |
|---------------|-----------------------------------|-------------------------------------------------|
| `PORT`        | HTTP port (default `3000`)        | `3000`                                          |
| `MONGODB_URI` | MongoDB connection string         | `mongodb://localhost:27017/session_booking`     |

### Tests

```bash
npm test
```

The suite (Jest + Supertest) starts an in-memory MongoDB, so no database setup is needed. It covers
every endpoint, the validation rules, and a concurrent double-booking case.

## API

All responses are JSON: `{ "success": true, "data": ... }` on success and
`{ "success": false, "message": "..." }` on error.

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | `POST`  | `/users` | Create a user (email must be unique) |
| 2 | `POST`  | `/sessions` | Create a session for a teacher (status `AVAILABLE`) |
| 3 | `GET`   | `/sessions/available?dateTimestamp={ms}` | AVAILABLE sessions on that date (**aggregation pipeline**) |
| 4 | `POST`  | `/sessions/:id/book` | Book a session for a user |
| 5 | `PATCH` | `/sessions/:id/complete` | Mark a BOOKED session as COMPLETED |
| 6 | `GET`   | `/users/:id/sessions` | A user's sessions split into upcoming and completed (**aggregation pipeline**) |
| – | `POST`  | `/teachers` | Helper to create a teacher, so sessions can be created |

### 1. Create user

`POST /users`

```json
{ "fullName": "Asha Rao", "email": "asha@example.com", "phone": "9876543210" }
```

`201` created · `400` missing or invalid fields · `409` email already registered.

### Create teacher (helper)

`POST /teachers`

```json
{ "fullName": "Ravi Kumar", "email": "ravi@example.com", "specialization": "Spoken English", "experience": 5 }
```

### 2. Create session

`POST /sessions`

```json
{ "teacherId": "<teacherId>", "startTime": "2026-12-01T10:00:00.000Z", "endTime": "2026-12-01T11:00:00.000Z" }
```

`startTime` / `endTime` accept an ISO date string or a millisecond timestamp.
`201` created with status `AVAILABLE` · `400` invalid input or `endTime <= startTime` · `404` teacher not found.

### 3. Available sessions for a date

`GET /sessions/available?dateTimestamp=1796112000000`

Returns every `AVAILABLE` session whose `startTime` falls on that calendar day (UTC), sorted by start
time, with the teacher's details. Implemented with an aggregation pipeline:
`$match` (status + day range) → `$sort` → `$lookup` teachers → `$unwind` → `$project` (adds `durationMinutes`).

`200` list · `400` missing or invalid `dateTimestamp`.

### 4. Book session

`POST /sessions/:id/book`

```json
{ "userId": "<userId>" }
```

The booking is a single conditional update (`status: AVAILABLE → BOOKED`), so two simultaneous
requests can never book the same session.

`200` booked · `404` user or session not found · `409` session already booked or not `AVAILABLE`.

### 5. Complete session

`PATCH /sessions/:id/complete`

Moves a `BOOKED` session to `COMPLETED` and sets `completedAt`.

`200` completed · `404` session not found · `409` session is not `BOOKED`.

### 6. User sessions

`GET /users/:id/sessions`

```json
{
  "success": true,
  "data": {
    "upcomingSessions": [ { "_id": "...", "startTime": "...", "status": "BOOKED", "teacher": { "fullName": "..." } } ],
    "completedSessions": [ { "_id": "...", "status": "COMPLETED", "completedAt": "...", "teacher": { } } ]
  }
}
```

Implemented with one aggregation pipeline: `$match` the user's BOOKED/COMPLETED sessions, then
`$facet` into `upcomingSessions` (BOOKED, soonest first) and `completedSessions` (COMPLETED, most recent
first), each with a teacher `$lookup`.

`200` · `400` invalid id · `404` user not found.

## Project structure

```
src/
  config/       env + database connection
  models/       User, Teacher, Session (Mongoose schemas + indexes)
  services/     business rules and aggregation pipelines
  controllers/  request parsing / validation and responses
  routes/       route table
  middleware/   central error handler + 404
  utils/        ApiError, asyncHandler, validation helpers
tests/          Jest + Supertest API tests (in-memory MongoDB)
postman/        Postman collection
```

## Design notes

- **Centralized error handling:** services throw `ApiError` (400/404/409); one Express error middleware
  formats every error, including Mongoose validation/cast errors and duplicate keys.
- **Async/await only:** route handlers are wrapped by `asyncHandler`, which forwards rejected promises
  to the error middleware.
- **Indexes:** `{ status, startTime }` for the available-sessions query and
  `{ userId, status, startTime }` for the user history query; unique index on user email.
- **Dates:** the available-sessions endpoint uses UTC day boundaries for the supplied timestamp.
