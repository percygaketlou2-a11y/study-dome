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

describe('quizzes', () => {
  test('take endpoint never exposes isCorrect on options', async () => {
    const { token } = await registerUser(request, app);
    const quiz = await getSeededQuiz();

    const res = await request(app).get(`/api/quizzes/take/${quiz.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const q of res.body.questions) {
      for (const opt of q.options ?? []) {
        expect(opt).not.toHaveProperty('isCorrect');
      }
    }
  });

  test('submitting all-correct answers scores 100%', async () => {
    const { token } = await registerUser(request, app);
    const quiz = await getSeededQuiz();

    const answers = {};
    for (const q of quiz.questions) {
      const correct = q.options.find((o) => o.isCorrect);
      answers[q.id] = q.questionType === 'short_answer' ? correct.optionText : correct.id;
    }

    const res = await request(app)
      .post('/api/quizzes/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ quizId: quiz.id, answers });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    expect(res.body.marksAwarded).toBe(res.body.totalMarks);
    expect(res.body.feedback.every((f) => f.isCorrect)).toBe(true);
  });

  test('submitting all-wrong answers scores 0%', async () => {
    const { token } = await registerUser(request, app);
    const quiz = await getSeededQuiz();

    const answers = {};
    for (const q of quiz.questions) {
      if (q.questionType === 'short_answer') {
        answers[q.id] = 'definitely wrong';
      } else {
        const wrong = q.options.find((o) => !o.isCorrect);
        answers[q.id] = wrong.id;
      }
    }

    const res = await request(app)
      .post('/api/quizzes/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ quizId: quiz.id, answers });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    expect(res.body.marksAwarded).toBe(0);
  });

  test('short-answer grading is case-insensitive', async () => {
    const { token } = await registerUser(request, app);
    const quiz = await getSeededQuiz();
    const shortQuestion = quiz.questions.find((q) => q.questionType === 'short_answer');
    const correctAnswer = shortQuestion.options.find((o) => o.isCorrect).optionText;

    const answers = { [shortQuestion.id]: correctAnswer.toUpperCase() };
    for (const q of quiz.questions) {
      if (q.id === shortQuestion.id) continue;
      answers[q.id] =
        q.questionType === 'short_answer'
          ? q.options.find((o) => o.isCorrect).optionText
          : q.options.find((o) => o.isCorrect).id;
    }

    const res = await request(app)
      .post('/api/quizzes/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ quizId: quiz.id, answers });

    const feedback = res.body.feedback.find((f) => f.questionId === shortQuestion.id);
    expect(feedback.isCorrect).toBe(true);
  });

  test('premium quiz is blocked for a free-plan user and unlocked after upgrade', async () => {
    const { token, user } = await registerUser(request, app);
    const quiz = await getSeededQuiz();

    const premiumQuiz = await prisma.quiz.create({
      data: {
        subjectId: quiz.subjectId,
        title: 'Temp Premium Quiz',
        totalMarks: 1,
        isPremium: true,
        questions: {
          create: [
            {
              questionText: 'Locked question?',
              questionType: 'true_false',
              marks: 1,
              options: { create: [{ optionText: 'True', isCorrect: true }, { optionText: 'False' }] },
            },
          ],
        },
      },
    });

    const blocked = await request(app)
      .get(`/api/quizzes/take/${premiumQuiz.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(403);

    await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);

    const unlocked = await request(app)
      .get(`/api/quizzes/take/${premiumQuiz.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(unlocked.status).toBe(200);

    void user;
  });
});
