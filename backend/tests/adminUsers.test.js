const request = require('supertest');
const app = require('../src/app');
const { registerUser, getAdminToken } = require('./helpers');

describe('admin user management', () => {
  test('admin can list users and toggle plan/admin on someone else', async () => {
    const adminToken = await getAdminToken(request, app);
    const { user } = await registerUser(request, app);

    const list = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((u) => u.id === user.id)).toBe(true);

    const patch = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'premium', isAdmin: true });
    expect(patch.status).toBe(200);
    expect(patch.body.plan).toBe('premium');
    expect(patch.body.isAdmin).toBe(true);
  });

  test('admin cannot remove their own admin access', async () => {
    const adminToken = await getAdminToken(request, app);
    const me = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    const self = me.body.find((u) => u.email === process.env.ADMIN_EMAIL);

    const res = await request(app)
      .patch(`/api/admin/users/${self.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isAdmin: false });
    expect(res.status).toBe(400);
  });

  test('admin cannot delete their own account, but can delete another user', async () => {
    const adminToken = await getAdminToken(request, app);
    const me = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    const self = me.body.find((u) => u.email === process.env.ADMIN_EMAIL);

    const selfDelete = await request(app)
      .delete(`/api/admin/users/${self.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(selfDelete.status).toBe(400);

    const { user } = await registerUser(request, app);
    const otherDelete = await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(otherDelete.status).toBe(204);
  });

  test('non-admin gets 403', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
