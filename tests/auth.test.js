const request = require('supertest');
const { createApp } = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./testUtils/db');

let app;

beforeAll(async () => {
  await connect();
  app = createApp();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('POST /api/auth/register', () => {
  test('creates a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe('alice');
  });

  test('rejects a duplicate username with 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice1@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice2@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  test('rejects a password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'bob',
      email: 'bob@example.com',
      password: '123',
    });

    expect(res.status).toBe(400);
  });

  test('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'carol',
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('succeeds with correct credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', email: 'dave@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dave', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('fails with the wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'erin', email: 'erin@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'erin', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('fails for an unknown username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'password123' });

    expect(res.status).toBe(401);
  });
});
