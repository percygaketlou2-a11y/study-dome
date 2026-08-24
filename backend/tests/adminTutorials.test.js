const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser, getAdminToken } = require('./helpers');

// A minimal valid 1x1 PNG, used to exercise the image upload path without a real fixture file.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('admin tutorials', () => {
  test('admin can create a tutorial, add steps (with and without an image), edit and delete', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const createRes = await request(app)
      .post('/api/admin/tutorials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId: subject.id, title: 'Solving simultaneous equations', isPremium: false });
    expect(createRes.status).toBe(201);
    const tutorialId = createRes.body.id;

    const step1Res = await request(app)
      .post(`/api/admin/tutorials/${tutorialId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'Isolate one variable')
      .field('order', '1');
    expect(step1Res.status).toBe(201);
    expect(step1Res.body.imageUrl).toBeNull();

    const step2Res = await request(app)
      .post(`/api/admin/tutorials/${tutorialId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'Substitute into the other equation')
      .field('order', '2')
      .attach('image', TINY_PNG, 'diagram.png');
    expect(step2Res.status).toBe(201);
    expect(step2Res.body.imageUrl).toMatch(/^\/uploads\/tutorial-images\//);

    const fullRes = await request(app)
      .get(`/api/admin/tutorials/${tutorialId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fullRes.body.steps).toHaveLength(2);

    const editStepRes = await request(app)
      .put(`/api/admin/tutorial-steps/${step1Res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'Isolate one variable (edited)')
      .field('order', '1');
    expect(editStepRes.status).toBe(200);
    expect(editStepRes.body.text).toBe('Isolate one variable (edited)');

    const deleteStepRes = await request(app)
      .delete(`/api/admin/tutorial-steps/${step1Res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteStepRes.status).toBe(204);

    const deleteTutorialRes = await request(app)
      .delete(`/api/admin/tutorials/${tutorialId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteTutorialRes.status).toBe(204);

    const afterDelete = await prisma.tutorial.findUnique({ where: { id: tutorialId } });
    expect(afterDelete).toBeNull();
  });

  test('rejects a non-image file for a step', async () => {
    const adminToken = await getAdminToken(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const tutorial = await prisma.tutorial.create({ data: { subjectId: subject.id, title: 'Temp' } });

    const res = await request(app)
      .post(`/api/admin/tutorials/${tutorial.id}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('text', 'Bad attachment')
      .attach('image', Buffer.from('not an image'), 'notes.txt');

    expect(res.status).toBe(400);
  });

  test('non-admin gets 403', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/tutorials').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
