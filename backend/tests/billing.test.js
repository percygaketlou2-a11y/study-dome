const request = require('supertest');
const app = require('../src/app');
const { registerUser } = require('./helpers');

describe('billing (manual plan toggle)', () => {
  test('new users start on the free plan', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/billing/status').set('Authorization', `Bearer ${token}`);
    expect(res.body.plan).toBe('free');
  });

  test('upgrade then downgrade flips the plan both ways', async () => {
    const { token } = await registerUser(request, app);

    const up = await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);
    expect(up.body.plan).toBe('premium');

    const status = await request(app).get('/api/billing/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.plan).toBe('premium');

    const down = await request(app).post('/api/billing/downgrade').set('Authorization', `Bearer ${token}`);
    expect(down.body.plan).toBe('free');
  });

  test('manual upgrade/downgrade are disabled in production, so premium cannot be granted for free', async () => {
    const { token } = await registerUser(request, app);
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const up = await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);
      expect(up.status).toBe(403);

      const config = await request(app).get('/api/billing/config').set('Authorization', `Bearer ${token}`);
      expect(config.body.devMode).toBe(false);

      const status = await request(app).get('/api/billing/status').set('Authorization', `Bearer ${token}`);
      expect(status.body.plan).toBe('free');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
