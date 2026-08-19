const request = require('supertest');
const app = require('../src/app');
const { uniqueEmail, getAdminToken } = require('./helpers');

describe('admin curricula and subjects', () => {
  test('create curriculum, create subject under it, then delete both', async () => {
    const adminToken = await getAdminToken(request, app);
    const name = uniqueEmail('curriculum').split('@')[0]; // unique-ish name

    const created = await request(app)
      .post('/api/admin/curricula')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, description: 'Test curriculum' });
    expect(created.status).toBe(201);

    const subject = await request(app)
      .post('/api/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ curriculumId: created.body.id, name: 'Test Subject', category: 'STEM' });
    expect(subject.status).toBe(201);

    const list = await request(app)
      .get(`/api/admin/curricula/${created.body.id}/subjects`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body).toHaveLength(1);

    const deleteSubject = await request(app)
      .delete(`/api/admin/subjects/${subject.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteSubject.status).toBe(204);

    const deleteCurriculum = await request(app)
      .delete(`/api/admin/curricula/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteCurriculum.status).toBe(204);
  });

  test('rejects a duplicate curriculum name', async () => {
    const adminToken = await getAdminToken(request, app);
    const name = uniqueEmail('dupcurriculum').split('@')[0];

    await request(app).post('/api/admin/curricula').set('Authorization', `Bearer ${adminToken}`).send({ name });
    const dup = await request(app).post('/api/admin/curricula').set('Authorization', `Bearer ${adminToken}`).send({ name });
    expect(dup.status).toBe(409);
  });
});
