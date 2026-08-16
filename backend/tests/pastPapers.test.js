const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser } = require('./helpers');

describe('past papers', () => {
  test('locked premium paper withholds file URLs from a free-plan user', async () => {
    const { token } = await registerUser(request, app);

    const subject = await prisma.subject.findFirst({
      where: { name: 'Mathematics', curriculum: { name: 'JC' } },
    });
    const paper = await prisma.pastPaper.create({
      data: {
        subjectId: subject.id,
        year: 2099,
        paperNumber: 9,
        isPremium: true,
        fileUrl: '/uploads/past-papers/secret.pdf',
      },
    });

    const res = await request(app)
      .get(`/api/past-papers/${subject.id}`)
      .set('Authorization', `Bearer ${token}`);

    const found = res.body.find((p) => p.id === paper.id);
    expect(found.locked).toBe(true);
    expect(found.fileUrl).toBeNull();
  });

  test('premium user sees the file URL for a premium paper', async () => {
    const { token } = await registerUser(request, app);
    await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);

    const subject = await prisma.subject.findFirst({
      where: { name: 'Mathematics', curriculum: { name: 'JC' } },
    });
    const paper = await prisma.pastPaper.create({
      data: {
        subjectId: subject.id,
        year: 2098,
        paperNumber: 9,
        isPremium: true,
        fileUrl: '/uploads/past-papers/visible.pdf',
      },
    });

    const res = await request(app)
      .get(`/api/past-papers/${subject.id}`)
      .set('Authorization', `Bearer ${token}`);

    const found = res.body.find((p) => p.id === paper.id);
    expect(found.locked).toBe(false);
    expect(found.fileUrl).toBe('/uploads/past-papers/visible.pdf');
  });
});
