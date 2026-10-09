const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser } = require('./helpers');

describe('dashboard', () => {
  test('reports per-subject progress and a continue-learning suggestion', async () => {
    const { token, user } = await registerUser(request, app);
    const curriculum = await prisma.curriculum.findFirst({ where: { name: 'JC' } });
    await request(app).patch('/api/user/curriculum').set('Authorization', `Bearer ${token}`).send({ curriculumId: curriculum.id });

    const before = await request(app).get('/api/user/dashboard').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    const mathsBefore = before.body.subjects.find((s) => s.name === 'Mathematics');
    expect(mathsBefore.quizzesTotal).toBeGreaterThan(0);
    expect(mathsBefore.quizzesCompleted).toBe(0);
    expect(before.body.continueSubject).toBeTruthy();
    expect(before.body.studiedToday).toBe(false);

    const quiz = await prisma.quiz.findFirst({ where: { subject: { name: 'Mathematics', curriculum: { name: 'JC' } } } });
    await prisma.quizResult.create({
      data: { userId: user.id, quizId: quiz.id, score: 80, marksAwarded: 8, totalMarks: 10 },
    });
    await prisma.dailyActivity.create({ data: { userId: user.id, date: new Date().toISOString().slice(0, 10) } });

    const after = await request(app).get('/api/user/dashboard').set('Authorization', `Bearer ${token}`);
    const mathsAfter = after.body.subjects.find((s) => s.name === 'Mathematics');
    expect(mathsAfter.quizzesCompleted).toBe(1);
    expect(after.body.studiedToday).toBe(true);
    expect(after.body.recentQuizzes[0].subjectId).toBe(quiz.subjectId);
  });
});
