const request = require('supertest');
const app = require('../src/app');
const { registerUser, uniqueEmail } = require('./helpers');

function extractToken(link) {
  return new URL(link, 'http://localhost').searchParams.get('token');
}

describe('account settings', () => {
  test('change display name', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('change password requires the correct current password', async () => {
    const email = uniqueEmail('pwchange');
    const { token } = await registerUser(request, app, { email, password: 'password123' });

    const wrong = await request(app)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'notright', newPassword: 'newpassword456' });
    expect(wrong.status).toBe(403);

    const right = await request(app)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(right.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'newpassword456' });
    expect(login.status).toBe(200);
  });

  test('change email requires password confirmation and resets verification', async () => {
    const { token } = await registerUser(request, app, { password: 'password123' });
    const newEmail = uniqueEmail('changed');

    const wrongPassword = await request(app)
      .patch('/api/user/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail, password: 'wrong-password' });
    expect(wrongPassword.status).toBe(403);

    const res = await request(app)
      .patch('/api/user/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(newEmail);
    expect(res.body.devVerifyLink).toMatch(/token=/);
  });
});

describe('password reset', () => {
  test('full forgot -> reset -> login-with-new-password flow', async () => {
    const email = uniqueEmail('reset');
    await registerUser(request, app, { email, password: 'password123' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.devResetLink).toMatch(/token=/);

    const token = extractToken(forgot.body.devResetLink);
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'brandnewpassword' });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toBeTruthy();

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'brandnewpassword' });
    expect(newLogin.status).toBe(200);
  });

  test('forgot-password for an unknown email is generic and does not leak a link', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('nobody') });
    expect(res.status).toBe(200);
    expect(res.body.devResetLink).toBeUndefined();
  });

  test('reset-password rejects an invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'whatever123' });
    expect(res.status).toBe(400);
  });
});

describe('email verification', () => {
  test('register -> verify -> dashboard reflects emailVerified', async () => {
    const { token, devVerifyLink } = await registerUser(request, app);

    const verifyToken = extractToken(devVerifyLink);
    const verify = await request(app).post('/api/auth/verify-email').send({ token: verifyToken });
    expect(verify.status).toBe(200);
    expect(verify.body.verified).toBe(true);

    const dashboard = await request(app).get('/api/user/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.user.emailVerified).toBe(true);
  });

  test('verify-email rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'garbage' });
    expect(res.status).toBe(400);
  });

  test('resend-verification issues a fresh link', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.devVerifyLink).toMatch(/token=/);
  });
});
