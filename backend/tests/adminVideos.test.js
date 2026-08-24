const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser, getAdminToken } = require('./helpers');

describe('admin videos', () => {
  test('admin can add, edit and delete a video lesson', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const createRes = await request(app)
      .post('/api/admin/videos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId: subject.id, title: 'Intro to Algebra', url: 'https://www.youtube.com/watch?v=abc123', isPremium: false });

    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('Intro to Algebra');

    const updateRes = await request(app)
      .put(`/api/admin/videos/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId: subject.id, title: 'Intro to Algebra (updated)', url: 'https://youtu.be/xyz789', isPremium: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('Intro to Algebra (updated)');
    expect(updateRes.body.isPremium).toBe(true);

    const listRes = await request(app).get('/api/admin/videos').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.find((v) => v.id === createRes.body.id)).toBeTruthy();

    const deleteRes = await request(app)
      .delete(`/api/admin/videos/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get('/api/admin/videos').set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.find((v) => v.id === createRes.body.id)).toBeUndefined();
  });

  test('rejects a non-YouTube/Vimeo url', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const res = await request(app)
      .post('/api/admin/videos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId: subject.id, title: 'Bad link', url: 'https://example.com/video.mp4' });

    expect(res.status).toBe(400);
  });

  test('non-admin gets 403', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/videos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
