const request = require('supertest');
const app = require('../src/app');
const { uniqueEmail } = require('./helpers');

describe('auth', () => {
  test('register creates a user with a token and free plan', async () => {
    const email = uniqueEmail('register');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email, password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.plan).toBe('free');
    expect(res.body.user.isAdmin).toBe(false);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.devVerifyLink).toMatch(/token=/);
  });

  test('register with the ADMIN_EMAIL is auto-promoted to admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: 'password123' });

    // May already exist from a prior test run against the same seeded DB.
    if (res.status === 409) {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: process.env.ADMIN_EMAIL, password: 'password123' });
      expect(login.body.user.isAdmin).toBe(true);
      return;
    }

    expect(res.status).toBe(201);
    expect(res.body.user.isAdmin).toBe(true);
  });

  test('register rejects a duplicate email', async () => {
    const email = uniqueEmail('dup');
    await request(app).post('/api/auth/register').send({ name: 'A', email, password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'B', email, password: 'password123' });

    expect(res.status).toBe(409);
  });

  test('login succeeds with correct credentials', async () => {
    const email = uniqueEmail('login');
    await request(app).post('/api/auth/register').send({ name: 'Login', email, password: 'password123' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('login rejects wrong password', async () => {
    const email = uniqueEmail('wrongpw');
    await request(app).post('/api/auth/register').send({ name: 'X', email, password: 'password123' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'nope123456' });

    expect(res.status).toBe(401);
  });

  test('login rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('unknown'), password: 'password123' });

    expect(res.status).toBe(401);
  });
});
