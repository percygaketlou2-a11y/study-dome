const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser, getAdminToken } = require('./helpers');

function samplePayload(subjectId, overrides = {}) {
  return {
    subjectId,
    title: 'Admin-created quiz',
    timeLimitMinutes: 10,
    isPremium: false,
    questions: [
      {
        questionText: 'Pick the right one',
        questionType: 'multiple_choice',
        explanation: 'Because it is right.',
        marks: 2,
        options: [
          { optionText: 'Right', isCorrect: true },
          { optionText: 'Wrong', isCorrect: false },
        ],
      },
      {
        questionText: 'True or false?',
        questionType: 'true_false',
        marks: 1,
        options: [
          { optionText: 'True', isCorrect: false },
          { optionText: 'False', isCorrect: true },
        ],
      },
      {
        questionText: 'Fill in',
        questionType: 'short_answer',
        marks: 3,
        options: [{ optionText: '42', isCorrect: true }],
      },
    ],
    ...overrides,
  };
}

async function getSubjectId() {
  const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
  return subject.id;
}

describe('admin quiz builder', () => {
  test('non-admin cannot create a quiz', async () => {
    const { token } = await registerUser(request, app);
    const subjectId = await getSubjectId();
    const res = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePayload(subjectId));
    expect(res.status).toBe(403);
  });

  test('admin can create a quiz with computed totalMarks and fetch its full detail', async () => {
    const adminToken = await getAdminToken(request, app);
    const subjectId = await getSubjectId();

    const create = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(samplePayload(subjectId));

    expect(create.status).toBe(201);
    expect(create.body.totalMarks).toBe(6); // 2 + 1 + 3
    expect(create.body.questions).toHaveLength(3);

    const full = await request(app)
      .get(`/api/admin/quizzes/${create.body.id}/full`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(full.status).toBe(200);
    const shortAnswer = full.body.questions.find((q) => q.questionType === 'short_answer');
    expect(shortAnswer.options[0].isCorrect).toBe(true);
  });

  test('rejects a multiple-choice question with zero or multiple correct options', async () => {
    const adminToken = await getAdminToken(request, app);
    const subjectId = await getSubjectId();

    const noCorrect = samplePayload(subjectId);
    noCorrect.questions[0].options = [
      { optionText: 'A', isCorrect: false },
      { optionText: 'B', isCorrect: false },
    ];
    const res = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(noCorrect);
    expect(res.status).toBe(400);
  });

  test('editing a quiz replaces its questions', async () => {
    const adminToken = await getAdminToken(request, app);
    const subjectId = await getSubjectId();

    const create = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(samplePayload(subjectId));

    const edited = samplePayload(subjectId, {
      title: 'Renamed quiz',
      questions: [
        {
          questionText: 'Only question now',
          questionType: 'true_false',
          marks: 5,
          options: [{ optionText: 'True', isCorrect: true }, { optionText: 'False', isCorrect: false }],
        },
      ],
    });

    const update = await request(app)
      .put(`/api/admin/quizzes/${create.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(edited);

    expect(update.status).toBe(200);
    expect(update.body.title).toBe('Renamed quiz');
    expect(update.body.totalMarks).toBe(5);
    expect(update.body.questions).toHaveLength(1);
  });

  test('deleting a quiz also clears any quiz results for it', async () => {
    const adminToken = await getAdminToken(request, app);
    const { token: studentToken, user } = await registerUser(request, app);
    const subjectId = await getSubjectId();

    const create = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(samplePayload(subjectId));
    const quizId = create.body.id;

    const take = await request(app).get(`/api/quizzes/take/${quizId}`).set('Authorization', `Bearer ${studentToken}`);
    const answers = {};
    for (const q of take.body.questions) {
      answers[q.id] = q.options ? q.options[0].id : 'whatever';
    }
    await request(app)
      .post('/api/quizzes/submit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ quizId, answers });

    const del = await request(app).delete(`/api/admin/quizzes/${quizId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const remaining = await prisma.quizResult.findMany({ where: { quizId } });
    expect(remaining).toHaveLength(0);
    void user;
  });
});
