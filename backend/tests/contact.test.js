const request = require('supertest');
const app = require('../src/app');
const { registerUser, getAdminToken } = require('./helpers');

describe('contact form', () => {
  test('a visitor can submit a message without being logged in, and an admin can read it', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Deputy Head', email: 'deputy@maunsenior.example', message: 'Interested in the StudyDome pilot.' });
    expect(res.status).toBe(201);

    const adminToken = await getAdminToken(request, app);
    const list = await request(app).get('/api/admin/contact-messages').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.find((m) => m.email === 'deputy@maunsenior.example')).toBeTruthy();
  });

  test('rejects a submission missing a required field', async () => {
    const res = await request(app).post('/api/contact').send({ name: 'No Email', message: 'Hello' });
    expect(res.status).toBe(400);
  });

  test('non-admin cannot read contact messages', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/contact-messages').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
