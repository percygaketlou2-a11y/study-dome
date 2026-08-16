const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser } = require('./helpers');

async function getSeededQuiz() {
  const subject = await prisma.subject.findFirst({
    where: { name: 'Mathematics', curriculum: { name: 'JC' } },
    include: { quizzes: { include: { questions: { include: { options: true } } } } },
  });
  return subject.quizzes[0];
}

describe('leaderboard', () => {
  test('a user who completes a quiz outranks one who has not', async () => {
    const active = await registerUser(request, app);
    const inactive = await registerUser(request, app);
    const quiz = await getSeededQuiz();

    const answers = {};
    for (const q of quiz.questions) {
      const correct = q.options.find((o) => o.isCorrect);
      answers[q.id] = q.questionType === 'short_answer' ? correct.optionText : correct.id;
    }
    await request(app)
      .post('/api/quizzes/submit')
      .set('Authorization', `Bearer ${active.token}`)
      .send({ quizId: quiz.id, answers });

    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', `Bearer ${active.token}`);

    const activeRow = res.body.find((r) => r.userId === active.user.id);
    const inactiveRow = res.body.find((r) => r.userId === inactive.user.id);

    expect(activeRow.totalActiveDays).toBeGreaterThanOrEqual(1);
    expect(activeRow.currentStreak).toBeGreaterThanOrEqual(1);
    expect(inactiveRow.totalActiveDays).toBe(0);
    expect(activeRow.rank).toBeLessThan(inactiveRow.rank);
  });
});
