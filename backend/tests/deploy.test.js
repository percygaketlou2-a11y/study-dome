const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { shouldServeFrontend, FRONTEND_CSP } = require('../src/config');
const { toPostgresSchema } = require('../scripts/preparePostgres');

describe('shouldServeFrontend', () => {
  test('serves the built website automatically in production, only when it exists', () => {
    expect(shouldServeFrontend({ NODE_ENV: 'production' }, true)).toBe(true);
    expect(shouldServeFrontend({ NODE_ENV: 'production' }, false)).toBe(false);
  });

  test('stays off in development unless forced, and can be forced off in production', () => {
    expect(shouldServeFrontend({ NODE_ENV: 'development' }, true)).toBe(false);
    expect(shouldServeFrontend({ SERVE_FRONTEND: 'true' }, true)).toBe(true);
    expect(shouldServeFrontend({ SERVE_FRONTEND: 'true' }, false)).toBe(false);
    expect(shouldServeFrontend({ NODE_ENV: 'production', SERVE_FRONTEND: 'false' }, true)).toBe(false);
  });
});

describe('the Content-Security-Policy that ships with the website', () => {
  test('matches the policy documented in the README', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', '..', 'README.md'), 'utf8');
    const documented = readme.replace(/\s+/g, ' ');
    for (const directive of FRONTEND_CSP.split('; ')) {
      expect(documented).toContain(directive);
    }
  });

  test('allows no inline or eval scripts and no framing by other sites', () => {
    expect(FRONTEND_CSP).toMatch(/script-src 'self'(;|$)/);
    expect(FRONTEND_CSP).not.toMatch(/unsafe-eval/);
    expect(FRONTEND_CSP).toContain("frame-ancestors 'none'");
  });
});

describe('PostgreSQL schema generation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

  test('changes only the database provider', () => {
    const generated = toPostgresSchema(source);
    expect(generated).toContain('provider = "postgresql"');
    expect(generated).not.toContain('provider = "sqlite"');
    const body = generated.split('\n').slice(1).join('\n');
    expect(body.replace('provider = "postgresql"', 'provider = "sqlite"')).toBe(source);
  });

  test('refuses a schema that is not SQLite, rather than silently doing nothing', () => {
    expect(() => toPostgresSchema('datasource db {\n  provider = "postgresql"\n}')).toThrow(/sqlite/);
  });
});

describe('serving the built website from the API server', () => {
  let dist;
  let uploads;
  let app;

  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'studydome-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Study Dome</title><div id="root"></div>');
    fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *');
    uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'studydome-uploads-'));

    const saved = { ...process.env };
    process.env.FRONTEND_DIST = dist;
    process.env.SERVE_FRONTEND = 'true';
    process.env.UPLOADS_DIR = uploads;
    jest.isolateModules(() => {
      app = require('../src/app');
    });
    process.env = saved;
  });

  afterAll(() => {
    fs.rmSync(dist, { recursive: true, force: true });
    fs.rmSync(uploads, { recursive: true, force: true });
  });

  test('the home page is delivered with the security headers', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
    expect(res.headers['content-security-policy']).toBe(FRONTEND_CSP);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('page addresses inside the app load the app, so a refresh or shared link works', async () => {
    for (const url of ['/dashboard', '/admin/login', '/accept-invite?token=abc', '/subjects/12/quizzes']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="root"');
    }
  });

  test('built files are cached for good, other files are always re-checked', async () => {
    const asset = await request(app).get('/assets/app-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    const robots = await request(app).get('/robots.txt');
    expect(robots.headers['cache-control']).toBe('no-cache');
  });

  test('the API and uploads are not swallowed by the page fallback', async () => {
    const health = await request(app).get('/api/health');
    expect(health.body).toEqual({ ok: true });
    expect(health.headers['content-security-policy']).toContain("default-src 'none'");

    const missingApi = await request(app).get('/api/nope');
    expect(missingApi.status).toBe(404);
    expect(missingApi.body).toEqual({ error: 'Not found' });

    const missingUpload = await request(app).get('/uploads/past-papers/none.pdf');
    expect(missingUpload.status).toBe(404);
    expect(missingUpload.body).toEqual({ error: 'Not found' });
  });

  test('uploads are read from, and created in, the configured UPLOADS_DIR', async () => {
    expect(fs.existsSync(path.join(uploads, 'past-papers'))).toBe(true);
    expect(fs.existsSync(path.join(uploads, 'tutorial-images'))).toBe(true);
    fs.writeFileSync(path.join(uploads, 'past-papers', 'sample.pdf'), '%PDF-1.4');
    const res = await request(app).get('/uploads/past-papers/sample.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('only GET and HEAD reach the page fallback', async () => {
    const res = await request(app).post('/dashboard').send({});
    expect(res.status).toBe(404);
  });
});
