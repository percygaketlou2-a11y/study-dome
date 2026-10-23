const nodemailer = require('nodemailer');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { validateEnv } = require('../src/config');
const { transportOptions } = require('../src/utils/mailer');
const { registerUser, uniqueEmail } = require('./helpers');

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('when the mail provider fails, requests still work', () => {
  let sendMail;

  beforeAll(() => {
    process.env.EMAIL_USER = 'sender@example.com';
    process.env.EMAIL_PASS = 'app-password';
    sendMail = jest.fn().mockRejectedValue(new Error('Invalid login: 535 Username and Password not accepted'));
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, verify: jest.fn() });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    jest.restoreAllMocks();
  });

  test('signup still creates the account, reports the email was not sent, and returns no link', async () => {
    const email = uniqueEmail('mailfail');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mail Fail', email, password: 'password123', acceptedTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(false);
    expect(res.body.devVerifyLink).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();

    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(200);
  });

  test('asking for another verification email says plainly that it could not be sent', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).post('/api/auth/resend-verification').set(bearer(token));
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/couldn't send the email/i);
  });

  test('forgot-password gives the same answer, so a mail failure cannot reveal which addresses have accounts', async () => {
    const email = uniqueEmail('forgotfail');
    await registerUser(request, app, { email });
    const known = await request(app).post('/api/auth/forgot-password').send({ email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail('nobody') });
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  test('changing email emails the new address and never returns the verification link', async () => {
    const email = uniqueEmail('changer');
    const { token } = await registerUser(request, app, { email, password: 'password123' });
    sendMail.mockResolvedValueOnce({}); // only the next send (the one to the new address) succeeds
    const res = await request(app)
      .patch('/api/user/email')
      .set(bearer(token))
      .send({ newEmail: uniqueEmail('changed'), password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(true);
    expect(res.body.devVerifyLink).toBeUndefined();
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({ subject: expect.stringMatching(/verify/i) }));
  });
});

describe('without email configured', () => {
  test('production never puts verification or reset links in a response', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const email = uniqueEmail('nolinks');
      const register = await request(app)
        .post('/api/auth/register')
        .send({ name: 'No Links', email, password: 'password123', acceptedTerms: true });
      expect(register.status).toBe(201);
      expect(register.body.devVerifyLink).toBeUndefined();

      const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(forgot.status).toBe(200);
      expect(forgot.body.devResetLink).toBeUndefined();
    } finally {
      process.env.NODE_ENV = original;
      jest.restoreAllMocks();
    }
  });

  test('a completed password reset also marks the address verified', async () => {
    const email = uniqueEmail('resetverify');
    await registerUser(request, app, { email });
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    const token = new URL(forgot.body.devResetLink, 'http://x').searchParams.get('token');

    const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'brandnewpassword' });
    expect(reset.status).toBe(200);
    expect(reset.body.user.emailVerified).toBe(true);
  });
});

describe('production email requirements', () => {
  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(8) + 'Kq9vLw2PzRm4TnYb7HcJd5FsGa3UeXo1',
    DATABASE_URL: 'postgresql://user:pass@db.example/studydome',
    UPLOADS_DIR: '/data/uploads',
    FRONTEND_URL: 'https://studydome.example',
    ADMIN_EMAIL: 'owner@example.com',
    TRUST_PROXY: '1',
  };

  test('refuses to start without email, because resets and verification depend on it', () => {
    expect(validateEnv(production).errors.join()).toMatch(/EMAIL_USER and EMAIL_PASS/);
  });

  test('ALLOW_NO_EMAIL turns that into a loud warning for a private test', () => {
    const result = validateEnv({ ...production, ALLOW_NO_EMAIL: 'true' });
    expect(result.errors).toEqual([]);
    expect(result.warnings.join()).toMatch(/server log/);
  });
});

describe('mail server settings', () => {
  test('uses Gmail by default', () => {
    expect(transportOptions({ EMAIL_USER: 'a@gmail.com', EMAIL_PASS: 'p' })).toMatchObject({ service: 'gmail' });
  });

  test('uses another SMTP provider when EMAIL_HOST is set', () => {
    expect(transportOptions({ EMAIL_USER: 'u', EMAIL_PASS: 'p', EMAIL_HOST: 'smtp.example.com' })).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    });
    expect(transportOptions({ EMAIL_USER: 'u', EMAIL_PASS: 'p', EMAIL_HOST: 'smtp.example.com', EMAIL_PORT: '465' })).toMatchObject({
      port: 465,
      secure: true,
    });
  });
});
