# Blog Platform API

A blog/content platform API built with Node.js, Express, and MongoDB. No frontend -- the API is documented and testable directly via Swagger UI.

## Why MongoDB here

Comments (and replies) are stored as **embedded documents** inside each post, rather than in a separate table joined by foreign keys. This is the classic case for choosing a document database: a post and its comment thread are almost always read and written together, so embedding avoids the joins a relational schema would need and keeps a post's entire comment thread available in a single `findById`. Tags are stored as a plain array field, which a relational schema would normally need a separate join table for.

## Structure

```
blog-platform/
├── src/
│   ├── config/db.js          Mongoose connection
│   ├── models/                User, Post (with embedded comments/replies)
│   ├── middleware/             JWT auth, centralized error handler
│   ├── controllers/            Auth and post/comment business logic
│   ├── routes/                 Express routes + Swagger (OpenAPI) annotations
│   ├── app.js                  Express app setup
│   └── server.js               Entry point
├── tests/                      Jest + Supertest, against an in-memory MongoDB
├── docker-compose.yml           Local MongoDB for development
└── .github/workflows/ci.yml     GitHub Actions CI
```

## Features

- JWT-based registration/login
- Post CRUD (author-only edit/delete)
- Nested comments and replies (comment -> reply, two levels deep)
- Tag filtering and full-text search (MongoDB text index) with pagination
- `GET /api/posts/trending` -- ranks posts by total comments + replies using an **aggregation pipeline**, the kind of query a relational schema would need a join + group-by for

## Prerequisites

- Node.js 18+ (`node -v`)
- Docker Desktop (used to run MongoDB locally)

## 1. Start MongoDB

```bash
docker compose up -d mongo
```

Runs on `localhost:27017`.

## 2. Configure environment

```bash
cp .env.example .env
```

The defaults already point at the Dockerized MongoDB above; only change `JWT_SECRET` if you want (it doesn't need to match anything else, it's only used by this app to sign its own tokens).

## 3. Install dependencies and run

```bash
npm install
npm run dev
```

Runs on `http://localhost:4000`. Interactive API docs (Swagger UI) are at `http://localhost:4000/api-docs` -- use it to register a user, copy the returned token, click **Authorize** in the top right, and try out the authenticated endpoints directly in the browser.

## Testing

```bash
npm test
```

Tests use `mongodb-memory-server` (a real, ephemeral MongoDB instance that runs in-process) rather than mocking the database, so the actual queries -- including the aggregation pipeline behind `/trending` -- are exercised for real, not simulated.

## CI/CD

`.github/workflows/ci.yml` runs `npm test` on every push and pull request to `main`. No database service container is needed in CI since `mongodb-memory-server` is self-contained.

## API Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /api/auth/register | Register | No |
| POST | /api/auth/login | Login, returns a JWT | No |
| GET | /api/posts?page=&size=&tag=&search= | Paginated, filterable, searchable list | No |
| GET | /api/posts/trending?limit= | Most-commented posts (aggregation) | No |
| GET | /api/posts/:id | Get a post with its full comment thread | No |
| POST | /api/posts | Create a post | Yes |
| PUT | /api/posts/:id | Update a post (author only) | Yes |
| DELETE | /api/posts/:id | Delete a post (author only) | Yes |
| POST | /api/posts/:id/comments | Add a comment | Yes |
| DELETE | /api/posts/:id/comments/:commentId | Delete a comment (comment author only) | Yes |
| POST | /api/posts/:id/comments/:commentId/replies | Reply to a comment | Yes |

## Ideas for further work

- A React frontend
- Rate limiting on comment creation
- Soft-delete for comments (mark as `[deleted]` instead of removing, to preserve reply threads)
- Full-text search relevance scoring (`$meta: "textScore"`) surfaced in the API response
