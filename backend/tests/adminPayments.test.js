const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser, getAdminToken } = require('./helpers');

describe('admin payments', () => {
  test('lists payment transactions with user info', async () => {
    const adminToken = await getAdminToken(request, app);
    const { user } = await registerUser(request, app);

    await prisma.paymentTransaction.create({
      data: { userId: user.id, transToken: `test-${Date.now()}`, amount: 60, currency: 'BWP', status: 'paid' },
    });

    const res = await request(app).get('/api/admin/payments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const row = res.body.find((t) => t.userEmail === user.email);
    expect(row.amount).toBe(60);
    expect(row.status).toBe('paid');
  });

  test('non-admin gets 403', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/payments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
