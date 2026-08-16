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
});
