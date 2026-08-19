const request = require('supertest');
const app = require('../src/app');
const { registerUser, uniqueEmail } = require('./helpers');

async function getAdminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: 'password123' });
  if (res.status === 200) return res.body.token;

  const registered = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: 'password123' });
  return registered.body.token;
}

describe('admin authorization', () => {
  test('non-admin is rejected with 403', async () => {
    const { token } = await registerUser(request, app);
    const res = await request(app).get('/api/admin/subjects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get('/api/admin/subjects');
    expect(res.status).toBe(401);
  });

  test('admin can list subjects and edit notes', async () => {
    const adminToken = await getAdminToken();

    const list = await request(app).get('/api/admin/subjects').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    const subject = list.body[0];

    const update = await request(app)
      .patch(`/api/admin/subjects/${subject.id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Test note content' });
    expect(update.status).toBe(200);
    expect(update.body.notes).toBe('Test note content');

    const { token: studentToken } = await registerUser(request, app);
    const view = await request(app)
      .get(`/api/subjects/${subject.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(view.body.notes).toBe('Test note content');
  });

  test('admin can toggle a quiz premium flag', async () => {
    const adminToken = await getAdminToken();
    const quizzes = await request(app).get('/api/admin/quizzes').set('Authorization', `Bearer ${adminToken}`);
    const quiz = quizzes.body[0];

    const toggled = await request(app)
      .patch(`/api/admin/quizzes/${quiz.id}/premium`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPremium: !quiz.isPremium });

    expect(toggled.status).toBe(200);
    expect(toggled.body.isPremium).toBe(!quiz.isPremium);

    // restore
    await request(app)
      .patch(`/api/admin/quizzes/${quiz.id}/premium`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPremium: quiz.isPremium });
  });

  test('admin can edit a past paper\'s metadata without replacing its files', async () => {
    const adminToken = await getAdminToken();
    const papers = await request(app).get('/api/admin/past-papers').set('Authorization', `Bearer ${adminToken}`);
    const paper = papers.body[0];

    const edit = await request(app)
      .patch(`/api/admin/past-papers/${paper.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('subjectId', paper.subjectId)
      .field('year', String(paper.year))
      .field('paperNumber', String(paper.paperNumber))
      .field('variant', String(paper.variant))
      .field('title', 'Edited title')
      .field('isPremium', String(paper.isPremium));

    expect(edit.status).toBe(200);
    expect(edit.body.title).toBe('Edited title');
  });

  void uniqueEmail;
});
