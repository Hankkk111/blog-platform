const request = require('supertest');
const { createApp } = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./testUtils/db');

let app;

async function registerAndLogin(username) {
  const email = `${username}@example.com`;
  await request(app).post('/api/auth/register').send({ username, email, password: 'password123' });
  const res = await request(app).post('/api/auth/login').send({ username, password: 'password123' });
  return res.body.token;
}

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

describe('Post CRUD', () => {
  test('creating a post requires authentication', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'Hello', body: 'World' });
    expect(res.status).toBe(401);
  });

  test('an authenticated user can create a post, with tags normalized to lowercase', async () => {
    const token = await registerAndLogin('alice');

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hello World', body: 'My first post', tags: ['React', 'JavaScript'] });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Hello World');
    expect(res.body.tags).toEqual(['react', 'javascript']);
    expect(res.body.authorUsername).toBe('alice');
  });

  test('lists posts with pagination metadata', async () => {
    const token = await registerAndLogin('alice');
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Post ${i}`, body: 'body' });
    }

    const res = await request(app).get('/api/posts?page=0&size=2');

    expect(res.status).toBe(200);
    expect(res.body.content).toHaveLength(2);
    expect(res.body.totalElements).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  test('filters posts by tag', async () => {
    const token = await registerAndLogin('alice');
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'React post', body: 'body', tags: ['React'] });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Vue post', body: 'body', tags: ['Vue'] });

    const res = await request(app).get('/api/posts?tag=react');

    expect(res.status).toBe(200);
    expect(res.body.content).toHaveLength(1);
    expect(res.body.content[0].title).toBe('React post');
  });

  test('only the author can update their post', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Alice post', body: 'body' });

    const res = await request(app)
      .put(`/api/posts/${createRes.body._id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked title' });

    expect(res.status).toBe(403);
  });

  test('only the author can delete their post', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Alice post', body: 'body' });

    const res = await request(app)
      .delete(`/api/posts/${createRes.body._id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  test('returns 404 for a non-existent post id', async () => {
    const res = await request(app).get('/api/posts/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed post id', async () => {
    const res = await request(app).get('/api/posts/not-a-valid-id');
    expect(res.status).toBe(400);
  });
});

describe('Comments and nested replies', () => {
  test('adds a comment to a post', async () => {
    const token = await registerAndLogin('alice');
    const post = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Post', body: 'body' });

    const res = await request(app)
      .post(`/api/posts/${post.body._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Nice post!' });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('Nice post!');
    expect(res.body.authorUsername).toBe('alice');
  });

  test('a different user can reply to a comment, nested under it', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const post = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Post', body: 'body' });

    const comment = await request(app)
      .post(`/api/posts/${post.body._id}/comments`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'First!' });

    const reply = await request(app)
      .post(`/api/posts/${post.body._id}/comments/${comment.body._id}/replies`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ body: 'I agree' });

    expect(reply.status).toBe(201);
    expect(reply.body.authorUsername).toBe('bob');

    const fullPost = await request(app).get(`/api/posts/${post.body._id}`);
    expect(fullPost.body.comments[0].replies).toHaveLength(1);
    expect(fullPost.body.comments[0].replies[0].body).toBe('I agree');
  });

  test('only the comment author can delete their own comment', async () => {
    const aliceToken = await registerAndLogin('alice');
    const bobToken = await registerAndLogin('bob');

    const post = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Post', body: 'body' });

    const comment = await request(app)
      .post(`/api/posts/${post.body._id}/comments`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'Comment' });

    const res = await request(app)
      .delete(`/api/posts/${post.body._id}/comments/${comment.body._id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/posts/trending', () => {
  test('ranks posts by total comments + replies, descending', async () => {
    const token = await registerAndLogin('alice');

    const popular = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Popular', body: 'body' });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Quiet', body: 'body' });

    // 2 top-level comments + 1 reply = engagement score of 3
    const c1 = await request(app)
      .post(`/api/posts/${popular.body._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'c1' });
    await request(app)
      .post(`/api/posts/${popular.body._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'c2' });
    await request(app)
      .post(`/api/posts/${popular.body._id}/comments/${c1.body._id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'r1' });

    const res = await request(app).get('/api/posts/trending?limit=5');

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Popular');
    expect(res.body[0].engagementScore).toBe(3);
    expect(res.body[1].title).toBe('Quiet');
    expect(res.body[1].engagementScore).toBe(0);
  });
});
