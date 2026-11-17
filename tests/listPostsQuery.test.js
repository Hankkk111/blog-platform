const request = require('supertest');
const { createApp } = require('../src/app');

// These requests are rejected before any database call, so this file
// needs no MongoDB instance.
const app = createApp();

describe('GET /api/posts query validation', () => {
  test('rejects a repeated tag parameter with 400', async () => {
    const res = await request(app).get('/api/posts?tag=react&tag=node');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('tag must be a single string value');
  });

  test('rejects an operator object in tag with 400', async () => {
    const res = await request(app).get('/api/posts?tag[$ne]=react');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('tag must be a single string value');
  });

  test('rejects an operator object in search with 400', async () => {
    const res = await request(app).get('/api/posts?search[$gt]=');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('search must be a single string value');
  });
});
