const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { validateEnv, allowedOrigins } = require('../src/config');
const { parseVideoUrl } = require('../src/utils/video');
const { registerUser, getAdminToken, uniqueEmail } = require('./helpers');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Every (method, path) registered on the app, including routers mounted under a prefix.
function listRoutes(stack, prefix = '') {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({ method: method.toUpperCase(), path: (prefix + layer.route.path).replace(/(.)\/$/, '$1') });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      const mount = layer.regexp.source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
      routes.push(...listRoutes(layer.handle.stack, prefix + mount));
    }
  }
  return routes;
}

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/staff-login',
  'POST /api/auth/invite-info', // the invitation token in the body is the credential
  'POST /api/auth/accept-invite',
  'POST /api/auth/verify-email',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'POST /api/contact',
  'GET /api/billing/dpo/callback', // payment provider redirect; verifies the transaction server-side
]);

const concretePath = (routePath) => routePath.replace(/:[A-Za-z]+/g, 'x');

describe('authentication and authorization are enforced on every route', () => {
  const routes = listRoutes(app._router.stack);

  test('the route walker actually finds the API', () => {
    expect(routes.length).toBeGreaterThan(70);
    expect(routes.some((r) => r.path === '/api/admin/content/overview')).toBe(true);
  });

  test('every route except the explicit public list rejects a request with no token', async () => {
    const protectedRoutes = routes.filter((r) => !PUBLIC_ROUTES.has(`${r.method} ${r.path}`));
    expect(protectedRoutes.length).toBeGreaterThan(60);

    const failures = [];
    for (const route of protectedRoutes) {
      const res = await request(app)[route.method.toLowerCase()](concretePath(route.path));
      if (res.status !== 401) failures.push(`${route.method} ${route.path} -> ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  test('every /api/admin route refuses a signed-in student', async () => {
    const { token } = await registerUser(request, app);
    const adminRoutes = routes.filter((r) => r.path.startsWith('/api/admin/'));
    expect(adminRoutes.length).toBeGreaterThan(40);

    const failures = [];
    for (const route of adminRoutes) {
      const res = await request(app)[route.method.toLowerCase()](concretePath(route.path)).set(bearer(token));
      if (res.status !== 403) failures.push(`${route.method} ${route.path} -> ${res.status}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('reviewer role is limited to Content Review', () => {
  test('a reviewer is refused on every /api/admin route except /api/admin/content/*, and admitted to those', async () => {
    const { token, user } = await registerUser(request, app);
    await prisma.user.update({ where: { id: user.id }, data: { role: 'reviewer' } });

    const adminRoutes = listRoutes(app._router.stack).filter((r) => r.path.startsWith('/api/admin/'));
    const failures = [];
    let admitted = 0;
    for (const route of adminRoutes) {
      const res = await request(app)[route.method.toLowerCase()](concretePath(route.path)).set(bearer(token));
      const isContent = route.path.startsWith('/api/admin/content/');
      if (isContent) {
        admitted += 1;
        if (res.status === 401 || res.status === 403) failures.push(`${route.method} ${route.path} should admit a reviewer -> ${res.status}`);
      } else if (res.status !== 403) {
        failures.push(`${route.method} ${route.path} should refuse a reviewer -> ${res.status}`);
      }
    }
    expect(admitted).toBeGreaterThan(5);
    expect(failures).toEqual([]);
  });
});

describe('malformed input cannot crash or confuse the server', () => {
  test('an email sent as an object is a 400, not a crash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { contains: 'a' }, password: 'x' });
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  test('a rejected promise inside an async handler reaches the error handler instead of killing the process', async () => {
    const probe = express();
    probe.get('/boom', async () => {
      throw new Error('database exploded');
    });
    probe.use((err, req, res, next) => res.status(500).json({ error: 'handled' }));
    const res = await request(probe).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('handled');
  });

  test('field types that reach the database layer are answered with a generic 400', async () => {
    const adminToken = await getAdminToken(request, app);
    const res = await request(app)
      .post('/api/admin/videos')
      .set(bearer(adminToken))
      .send({ subjectId: { not: '' }, title: 'x', url: 'https://youtu.be/abc123' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|invocation|findUnique/i);
  });

  test('invalid JSON, oversized bodies and unknown routes get clean JSON errors', async () => {
    const badJson = await request(app).post('/api/contact').set('Content-Type', 'application/json').send('{"name": ');
    expect(badJson.status).toBe(400);
    expect(badJson.body).toEqual({ error: 'Request body is not valid JSON' });

    const huge = await request(app).post('/api/contact').send({ name: 'a', email: 'a@b.co', message: 'x'.repeat(200 * 1024) });
    expect(huge.status).toBe(413);

    const missing = await request(app).get('/api/no-such-route');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Not found' });
    expect(JSON.stringify(missing.body)).not.toMatch(/express|cannot get/i);
  });

  test('the contact form validates types and lengths', async () => {
    const send = (body) => request(app).post('/api/contact').send(body);
    expect((await send({ name: ['a'], email: 'a@b.co', message: 'hi' })).status).toBe(400);
    expect((await send({ name: 'A', email: 'not-an-email', message: 'hi' })).status).toBe(400);
    expect((await send({ name: 'A', email: 'a@b.co', message: 'x'.repeat(5001) })).status).toBe(400);
  });
});

describe('accounts and passwords', () => {
  test('emails are stored in one canonical form, so a case variant of ADMIN_EMAIL cannot become a second (admin) account', async () => {
    await getAdminToken(request, app);
    const variant = process.env.ADMIN_EMAIL.toUpperCase();
    expect(variant).not.toBe(process.env.ADMIN_EMAIL);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Impostor', email: variant, password: 'password123', acceptedTerms: true });
    expect(res.status).toBe(409);

    const mixed = uniqueEmail('Mixed.Case').replace('mixed.case', 'Mixed.Case').toUpperCase();
    const created = await registerUser(request, app, { email: mixed });
    expect(created.user.email).toBe(mixed.toLowerCase());
    const login = await request(app).post('/api/auth/login').send({ email: mixed, password: 'password123' });
    expect(login.status).toBe(200);
  });

  test('passwords must be 8 to 72 bytes, and consent must be exactly true', async () => {
    const register = (password, acceptedTerms = true) =>
      request(app).post('/api/auth/register').send({ name: 'P', email: uniqueEmail('pw'), password, acceptedTerms });

    expect((await register('1234567')).status).toBe(400);
    expect((await register('x'.repeat(73))).status).toBe(400);
    expect((await register('12345678')).status).toBe(201);
    expect((await register('password123', 'yes')).status).toBe(400);
  });

  test('changing a password signs out every older session but keeps the current device signed in', async () => {
    const { user } = await registerUser(request, app);
    const issuedLongAgo = jwt.sign({ userId: user.id, iat: Math.floor(Date.now() / 1000) - 120 }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });

    const before = await request(app).get('/api/user/dashboard').set(bearer(issuedLongAgo));
    expect(before.status).toBe(200);

    const changed = await request(app)
      .patch('/api/user/password')
      .set(bearer(issuedLongAgo))
      .send({ currentPassword: 'password123', newPassword: 'a-new-password-1' });
    expect(changed.status).toBe(200);
    expect(changed.body.token).toBeTruthy();

    expect((await request(app).get('/api/user/dashboard').set(bearer(issuedLongAgo))).status).toBe(401);
    expect((await request(app).get('/api/user/dashboard').set(bearer(changed.body.token))).status).toBe(200);
  });

  test('a deleted account stops working immediately, not when its token expires', async () => {
    const { token, user } = await registerUser(request, app);
    expect((await request(app).get('/api/user/dashboard').set(bearer(token))).status).toBe(200);
    await prisma.user.delete({ where: { id: user.id } });
    expect((await request(app).get('/api/user/dashboard').set(bearer(token))).status).toBe(401);
  });

  test('tokens signed with another algorithm or secret are refused', async () => {
    const { user } = await registerUser(request, app);
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
      '.' + Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url') + '.';
    const wrongSecret = jwt.sign({ userId: user.id }, 'some-other-secret');
    const hs512 = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { algorithm: 'HS512' });

    for (const token of [none, wrongSecret, hs512]) {
      expect((await request(app).get('/api/user/dashboard').set(bearer(token))).status).toBe(401);
    }
  });

  test('once email is configured an admin must have a verified email', async () => {
    const adminToken = await getAdminToken(request, app);
    const admin = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });
    const saved = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };

    try {
      process.env.EMAIL_USER = 'sender@example.com';
      process.env.EMAIL_PASS = 'app-password';
      await prisma.user.update({ where: { id: admin.id }, data: { emailVerified: false } });
      expect((await request(app).get('/api/admin/content/overview').set(bearer(adminToken))).status).toBe(403);

      await prisma.user.update({ where: { id: admin.id }, data: { emailVerified: true } });
      expect((await request(app).get('/api/admin/content/overview').set(bearer(adminToken))).status).toBe(200);
    } finally {
      if (saved.user === undefined) delete process.env.EMAIL_USER;
      else process.env.EMAIL_USER = saved.user;
      if (saved.pass === undefined) delete process.env.EMAIL_PASS;
      else process.env.EMAIL_PASS = saved.pass;
    }
  });
});

describe('brute-force protection', () => {
  const original = process.env.ENABLE_RATE_LIMIT_IN_TESTS;
  beforeAll(() => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
    else process.env.ENABLE_RATE_LIMIT_IN_TESTS = original;
  });

  test('five failed logins for one account are allowed, the sixth is blocked', async () => {
    const email = uniqueEmail('bruteforce');
    const attempt = () => request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });

    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  test('successful logins are not counted, so a whole class can sign in from one school IP', async () => {
    const { user } = await registerUser(request, app, { password: 'class-password-1' });
    for (let i = 0; i < 8; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'class-password-1' });
      expect(res.status).toBe(200);
    }
  });

  test('the contact form allows five messages an hour per IP', async () => {
    const send = () => request(app).post('/api/contact').send({ name: 'Spam', email: 'spam@example.com', message: 'hello' });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await send()).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe('HTTP headers and CORS', () => {
  test('API responses carry hardening headers and do not reveal the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBeTruthy();
  });

  test('only the configured frontend origin may read API responses from a browser', async () => {
    expect(allowedOrigins({})).toContain('http://localhost:5173');
    expect(allowedOrigins({ FRONTEND_URL: 'https://app.studydome.example/home' })).toEqual(['https://app.studydome.example']);
    expect(allowedOrigins({ CORS_ORIGINS: 'https://a.example, https://b.example/' })).toEqual(['https://a.example', 'https://b.example']);

    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const stranger = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(stranger.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('uploaded files are served with nosniff and are framable only by the frontend; dotfiles are refused', async () => {
    const dir = path.join(__dirname, '..', 'uploads', 'past-papers');
    const file = path.join(dir, 'security-test.pdf');
    fs.writeFileSync(file, '%PDF-1.4 test');
    try {
      const res = await request(app).get('/uploads/past-papers/security-test.pdf');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain('frame-ancestors');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');

      const dotfile = await request(app).get('/uploads/past-papers/.gitkeep');
      expect(dotfile.status).toBe(404);
      expect(dotfile.body).toEqual({ error: 'Not found' });
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('uploads and embeds', () => {
  test('the stored file extension comes from the verified content type, not the uploaded filename', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const tutorial = await prisma.tutorial.create({ data: { subjectId: subject.id, title: 'Upload hardening' } });

    const res = await request(app)
      .post(`/api/admin/tutorials/${tutorial.id}/steps`)
      .set(bearer(adminToken))
      .field('text', 'Disguised upload')
      .field('imageAlt', 'A one-pixel test image')
      .attach('image', TINY_PNG, { filename: 'evil.html', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toMatch(/\.png$/);
    expect(res.body.imageUrl).not.toMatch(/html/);

    await request(app).delete(`/api/admin/tutorials/${tutorial.id}`).set(bearer(adminToken));
  });

  test('a file that only claims to be a PDF by its name is rejected', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const res = await request(app)
      .post('/api/admin/past-papers')
      .set(bearer(adminToken))
      .field('subjectId', subject.id)
      .field('year', '2031')
      .field('paperNumber', '1')
      .attach('examFile', Buffer.from('<script>alert(1)</script>'), { filename: 'paper.pdf', contentType: 'text/html' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only PDF files are allowed');
  });

  test('video links cannot smuggle a path, query or quote into the embed URL', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(parseVideoUrl('https://vimeo.com/123456789').embedUrl).toBe('https://player.vimeo.com/video/123456789');
    for (const bad of [
      'https://www.youtube.com/watch?v=abc/../../redirect',
      'https://www.youtube.com/watch?v=abc"onload="x',
      'https://www.youtube.com/watch?v=a',
      'https://youtube.com.evil.example/watch?v=abcdef',
      'https://www.youtube.com@evil.example/watch?v=abcdef',
      'javascript:alert(1)',
    ]) {
      expect(() => parseVideoUrl(bad)).toThrow();
    }
  });
});

describe('production configuration checks', () => {
  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(8) + 'Kq9vLw2PzRm4TnYb7HcJd5FsGa3UeXo1',
    DATABASE_URL: 'postgresql://user:pass@db.example/studydome',
    UPLOADS_DIR: '/data/uploads',
    FRONTEND_URL: 'https://studydome.example',
    ADMIN_EMAIL: 'owner@example.com',
    EMAIL_USER: 'sender@example.com',
    EMAIL_PASS: 'app-password',
    TRUST_PROXY: '1',
  };

  test('a strong, complete production config has no errors or warnings', () => {
    expect(validateEnv(production)).toEqual({ errors: [], warnings: [] });
  });

  test('a missing, short or placeholder JWT secret stops a production server from starting', () => {
    expect(validateEnv({ ...production, JWT_SECRET: '' }).errors.length).toBeGreaterThan(0);
    expect(validateEnv({ ...production, JWT_SECRET: 'short' }).errors.length).toBeGreaterThan(0);
    expect(validateEnv({ ...production, JWT_SECRET: 'dev-only-secret-change-me-dev-only-secret' }).errors.length).toBeGreaterThan(0);
  });

  test('the same weak secret is only a warning outside production', () => {
    const dev = validateEnv({ JWT_SECRET: 'dev-only-secret-change-me' });
    expect(dev.errors).toEqual([]);
    expect(dev.warnings.length).toBeGreaterThan(0);
  });

  test('production flags a missing FRONTEND_URL, SQLite, an unset uploads folder and unset proxy trust', () => {
    expect(validateEnv({ ...production, FRONTEND_URL: undefined }).errors.join()).toMatch(/FRONTEND_URL/);
    expect(validateEnv({ ...production, DATABASE_URL: 'file:./dev.db' }).errors.join()).toMatch(/PostgreSQL/);
    expect(validateEnv({ ...production, UPLOADS_DIR: undefined }).warnings.join()).toMatch(/UPLOADS_DIR/);
    expect(validateEnv({ ...production, TRUST_PROXY: undefined }).warnings.join()).toMatch(/TRUST_PROXY/);
  });
});
