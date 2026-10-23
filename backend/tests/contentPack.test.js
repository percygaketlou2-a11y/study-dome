const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { loadContentPack, importContentPack, validatePack } = require('../src/utils/contentImport');
const { registerUser, getAdminToken } = require('./helpers');

const PACK_DIR = path.join(__dirname, '..', 'prisma', 'content', 'bgcse');

let pack;
let firstImport;
let adminToken;
let studentToken;
let student;
let chemistry;

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const admin = (method, url) => request(app)[method](url).set(auth(adminToken));
const asStudent = (method, url) => request(app)[method](url).set(auth(studentToken));

beforeAll(async () => {
  pack = loadContentPack(PACK_DIR);
  firstImport = await importContentPack(prisma, pack);
  adminToken = await getAdminToken(request, app);
  const registered = await registerUser(request, app);
  studentToken = registered.token;
  student = registered.user;
  chemistry = await prisma.subject.findFirst({ where: { name: 'Chemistry', curriculum: { name: 'BGCSE' } } });
}, 120000);

describe('content pack import', () => {
  test('files every item in its place on the existing BGCSE subjects', async () => {
    expect(firstImport.subjects).toEqual({ created: 0, skipped: 6 });
    expect(firstImport.topics.created).toBe(187);
    expect(firstImport.objectives.created).toBe(1299);
    expect(firstImport.notes.created).toBe(32);
    expect(firstImport.quizzes.created).toBe(6);
    expect(firstImport.mcqs.created).toBe(105);
    expect(firstImport.structuredQuestions.created).toBe(19);
    expect(firstImport.structuredParts.created).toBe(45);

    expect(chemistry.subjectCode).toBe('0570');
    // The pack says "Design and Technology"; the seed says "Design & Technology". They must merge, not duplicate.
    expect(await prisma.subject.count({ where: { name: { contains: 'Technology' }, curriculum: { name: 'BGCSE' } } })).toBe(1);
  });

  test('a second run changes nothing, so review progress is never overwritten', async () => {
    const again = await importContentPack(prisma, pack);
    for (const key of ['topics', 'objectives', 'notes', 'quizzes', 'mcqs', 'structuredQuestions']) {
      expect(again[key].created).toBe(0);
    }
    expect(again.structuredParts.created).toBe(0);
  });

  test('imported items start as not reviewed, and MCQs keep their A-D order and one correct answer', async () => {
    const mcqs = await prisma.question.findMany({ where: { key: { not: null } }, include: { options: { orderBy: { order: 'asc' } } } });
    expect(mcqs).toHaveLength(105);
    for (const q of mcqs) {
      expect(q.reviewStatus).toBe('not_reviewed');
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
    const source = pack.questions.find((q) => q.key === 'CHEM-3.2-Q01');
    const imported = mcqs.find((q) => q.key === 'CHEM-3.2-Q01');
    expect(imported.options.map((o) => o.optionText)).toEqual(source.options.map((o) => o.text));
    expect(imported.options.find((o) => o.isCorrect).optionText).toBe(source.options.find((o) => o.key === source.correctOption).text);
  });

  test('rejects a pack with dangling references before writing anything', () => {
    const broken = { ...pack, notes: [{ ...pack.notes[0], key: 'X-N01', topicKey: 'NOPE-9.9' }] };
    expect(validatePack(broken).some((e) => e.includes('unknown topic NOPE-9.9'))).toBe(true);
    return expect(importContentPack(prisma, broken)).rejects.toThrow(/invalid/);
  });
});

describe('students only see approved content', () => {
  test('nothing from the pack is visible while it is unreviewed', async () => {
    const quizzes = await asStudent('get', `/api/quizzes/${chemistry.id}`);
    expect(quizzes.body.find((q) => q.title.includes('mole'))).toBeUndefined();

    const notes = await asStudent('get', `/api/subjects/${chemistry.id}/topic-notes`);
    expect(notes.body).toEqual([]);

    const structured = await asStudent('get', `/api/structured/${chemistry.id}`);
    expect(structured.body).toEqual([]);

    const draftQuiz = await prisma.quiz.findFirst({ where: { subjectId: chemistry.id, topic: { key: 'CHEM-3.2' } } });
    const take = await asStudent('get', `/api/quizzes/take/${draftQuiz.id}`);
    expect(take.status).toBe(404);
  });

  test('approving an MCQ publishes just that question, graded against the right answer', async () => {
    const list = await admin('get', `/api/admin/content/mcqs?subjectId=${chemistry.id}`);
    expect(list.body).toHaveLength(20);
    const target = list.body[0];

    const approved = await admin('patch', `/api/admin/content/mcqs/${target.id}`).send({
      reviewStatus: 'approved',
      reviewerName: 'Mrs K. Molefe',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.reviewerName).toBe('Mrs K. Molefe');

    const quizzes = await asStudent('get', `/api/quizzes/${chemistry.id}`);
    const quiz = quizzes.body.find((q) => q.title.includes('mole'));
    expect(quiz.questionCount).toBe(1);
    expect(quiz.totalMarks).toBe(1);

    const take = await asStudent('get', `/api/quizzes/take/${quiz.id}`);
    expect(take.body.questions).toHaveLength(1);
    expect(take.body.questions[0].options.map((o) => o.optionText)).toEqual(target.options.map((o) => o.optionText));
    expect(JSON.stringify(take.body)).not.toContain('isCorrect');

    const correct = target.options.find((o) => o.isCorrect);
    const submit = await asStudent('post', '/api/quizzes/submit').send({
      quizId: quiz.id,
      answers: { [take.body.questions[0].id]: correct.id },
    });
    expect(submit.body.score).toBe(100);
    expect(submit.body.totalQuestions).toBe(1);
  });

  test('the dashboard counts only quizzes a student can actually open', async () => {
    await asStudent('patch', '/api/user/curriculum').send({
      curriculumId: (await prisma.curriculum.findUnique({ where: { name: 'BGCSE' } })).id,
    });
    const dashboard = await asStudent('get', '/api/user/dashboard');
    const physics = dashboard.body.subjects.find((s) => s.name === 'Physics');
    const chem = dashboard.body.subjects.find((s) => s.name === 'Chemistry');
    expect(physics.quizzesTotal).toBe(0);
    expect(chem.quizzesTotal).toBe(1);
    expect(chem.quizzesCompleted).toBe(1);
  });

  test('approved notes show up grouped by topic; rejecting hides them again', async () => {
    const notes = await admin('get', `/api/admin/content/notes?subjectId=${chemistry.id}`);
    expect(notes.body).toHaveLength(4);
    const note = notes.body[0];

    await admin('patch', `/api/admin/content/notes/${note.id}`).send({ reviewStatus: 'approved' });
    const visible = await asStudent('get', `/api/subjects/${chemistry.id}/topic-notes`);
    expect(visible.body).toHaveLength(1);
    expect(visible.body[0].topic.title).toBe('The mole');
    expect(visible.body[0].notes[0].heading).toBe(note.heading);

    await admin('patch', `/api/admin/content/notes/${note.id}`).send({ reviewStatus: 'rejected', corrections: 'Wrong level' });
    const hidden = await asStudent('get', `/api/subjects/${chemistry.id}/topic-notes`);
    expect(hidden.body).toEqual([]);
  });

  test('a structured question appears only once every part is approved, and withholds its mark scheme', async () => {
    const list = await admin('get', `/api/admin/content/structured?subjectId=${chemistry.id}`);
    const question = list.body[0];
    expect(question.parts.length).toBeGreaterThan(1);

    for (const part of question.parts.slice(0, -1)) {
      await admin('patch', `/api/admin/content/structured-parts/${part.id}`).send({ reviewStatus: 'approved' });
    }
    const partial = await asStudent('get', `/api/structured/${chemistry.id}`);
    expect(partial.body).toEqual([]);

    const last = question.parts[question.parts.length - 1];
    await admin('patch', `/api/admin/content/structured-parts/${last.id}`).send({ reviewStatus: 'approved' });
    const full = await asStudent('get', `/api/structured/${chemistry.id}`);
    expect(full.body).toHaveLength(1);
    expect(JSON.stringify(full.body)).not.toContain('markScheme');
    expect(full.body[0].parts).toHaveLength(question.parts.length);
  });

  test('the mark scheme is released only after every part has an answer', async () => {
    const [visible] = (await asStudent('get', `/api/structured/${chemistry.id}`)).body;
    const [first, ...rest] = visible.parts;

    const incomplete = await asStudent('post', `/api/structured/${visible.id}/reveal`).send({ answers: { [first.id]: 'my answer' } });
    expect(incomplete.status).toBe(400);
    expect(JSON.stringify(incomplete.body)).not.toContain('markScheme');

    const answers = Object.fromEntries(visible.parts.map((p) => [p.id, `answer ${p.label}`]));
    const revealed = await asStudent('post', `/api/structured/${visible.id}/reveal`).send({ answers });
    expect(revealed.status).toBe(200);
    expect(revealed.body.parts).toHaveLength(visible.parts.length);
    expect(revealed.body.parts[0].markScheme).toBeTruthy();
    expect(revealed.body.parts[0].answer).toBe(`answer ${first.label}`);
    expect(rest.length).toBeGreaterThan(0);

    const activity = await prisma.dailyActivity.count({ where: { userId: student.id } });
    expect(activity).toBeGreaterThan(0);
  });
});

describe('admin Content Review', () => {
  test('is admin only', async () => {
    const res = await asStudent('get', '/api/admin/content/overview');
    expect(res.status).toBe(403);
  });

  test('overview reports review progress per subject', async () => {
    const res = await admin('get', '/api/admin/content/overview');
    expect(res.body).toHaveLength(6);
    const chem = res.body.find((s) => s.name === 'Chemistry');
    expect(chem.mcqs.total).toBe(20);
    expect(chem.mcqs.approved).toBe(1);
    expect(chem.notes.total).toBe(4);
    expect(chem.notes.rejected).toBe(1);
    expect(chem.structuredParts.approved).toBeGreaterThan(0);
    expect(chem.topics).toBeGreaterThan(0);
    expect(chem.objectives).toBeGreaterThan(0);
  });

  test('records reviewer corrections and a suggested correct answer, and validates them', async () => {
    const [q] = (await admin('get', `/api/admin/content/mcqs?subjectId=${chemistry.id}`)).body.slice(1);

    const ok = await admin('patch', `/api/admin/content/mcqs/${q.id}`).send({
      reviewStatus: 'approve_with_edits',
      suggestedCorrectOption: 'c',
      corrections: 'Option C: write 0.50 mol, not 0.5',
    });
    expect(ok.body.suggestedCorrectOption).toBe('C');
    expect(ok.body.corrections).toMatch(/0.50 mol/);
    expect(ok.body.reviewStatus).toBe('approve_with_edits');

    expect((await admin('patch', `/api/admin/content/mcqs/${q.id}`).send({ reviewStatus: 'maybe' })).status).toBe(400);
    expect((await admin('patch', `/api/admin/content/mcqs/${q.id}`).send({ suggestedCorrectOption: 'Z' })).status).toBe(400);

    const stillHidden = await asStudent('get', `/api/quizzes/${chemistry.id}`);
    expect(stillHidden.body.find((x) => x.title.includes('mole')).questionCount).toBe(1);
  });

  test('applying an edit changes what students are graded against', async () => {
    const [, , q] = (await admin('get', `/api/admin/content/mcqs?subjectId=${chemistry.id}`)).body;
    const newCorrect = q.options.find((o) => !o.isCorrect);

    const edited = await admin('patch', `/api/admin/content/mcqs/${q.id}`).send({
      reviewStatus: 'approved',
      questionText: 'Edited stem?',
      correctOptionId: newCorrect.id,
      options: [{ id: newCorrect.id, optionText: 'Edited correct option' }],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.questionText).toBe('Edited stem?');
    expect(edited.body.options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(edited.body.options.find((o) => o.isCorrect).optionText).toBe('Edited correct option');

    const foreign = await prisma.option.findFirst({ where: { questionId: { not: q.id } } });
    const bad = await admin('patch', `/api/admin/content/mcqs/${q.id}`).send({ correctOptionId: foreign.id });
    expect(bad.status).toBe(400);
  });

  test('editing marks keeps a structured question\'s total in step with its parts', async () => {
    const [question] = (await admin('get', `/api/admin/content/structured?subjectId=${chemistry.id}`)).body;
    const part = question.parts[0];
    const res = await admin('patch', `/api/admin/content/structured-parts/${part.id}`).send({ marks: part.marks + 3 });
    expect(res.body.totalMarks).toBe(question.totalMarks + 3);
    expect((await admin('patch', `/api/admin/content/structured-parts/${part.id}`).send({ marks: 0 })).status).toBe(400);
  });

  test('the quiz builder cannot overwrite a content-pack quiz and silently reset its reviews', async () => {
    const quiz = await prisma.quiz.findFirst({ where: { subjectId: chemistry.id, topic: { key: 'CHEM-3.2' } } });
    const res = await admin('put', `/api/admin/quizzes/${quiz.id}`).send({
      subjectId: chemistry.id,
      title: 'Overwrite attempt',
      questions: [
        { questionText: 'Q?', questionType: 'multiple_choice', options: [{ optionText: 'a', isCorrect: true }, { optionText: 'b' }] },
      ],
    });
    expect(res.status).toBe(409);
    const unchanged = await prisma.question.count({ where: { quizId: quiz.id, key: { not: null } } });
    expect(unchanged).toBe(20);
  });

  test('the topic map shows which syllabus objectives already have content', async () => {
    const res = await admin('get', `/api/admin/content/topic-map?subjectId=${chemistry.id}`);
    const mole = res.body.find((t) => t.code === '3.2');
    expect(mole.noteCount).toBe(4);
    expect(mole.mcqCount).toBe(20);
    expect(mole.structuredCount).toBe(3);
    expect(mole.objectives.some((o) => o.covered)).toBe(true);
    expect(res.body.find((t) => t.code === '1.1').objectives.every((o) => !o.covered)).toBe(true);
    expect(res.body.length).toBeGreaterThan(20);
  });
});
