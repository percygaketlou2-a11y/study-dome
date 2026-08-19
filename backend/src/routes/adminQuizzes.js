const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

const QUESTION_TYPES = new Set(['multiple_choice', 'short_answer', 'true_false']);

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'At least one question is required';
  }
  for (const [i, q] of questions.entries()) {
    if (!q.questionText || !q.questionText.trim()) {
      return `Question ${i + 1}: text is required`;
    }
    if (!QUESTION_TYPES.has(q.questionType)) {
      return `Question ${i + 1}: invalid question type`;
    }
    if (!Array.isArray(q.options) || q.options.length === 0) {
      return `Question ${i + 1}: at least one option is required`;
    }
    if (q.options.some((o) => !o.optionText || !o.optionText.toString().trim())) {
      return `Question ${i + 1}: every option needs text`;
    }
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (q.questionType === 'short_answer') {
      if (q.options.length !== 1) {
        return `Question ${i + 1}: short-answer questions take exactly one accepted answer`;
      }
    } else if (correctCount !== 1) {
      return `Question ${i + 1}: mark exactly one option as correct`;
    }
  }
  return null;
}

function buildQuestionsCreate(questions) {
  return questions.map((q, i) => ({
    questionText: q.questionText.trim(),
    questionType: q.questionType,
    explanation: q.explanation?.trim() || null,
    marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    order: i,
    options: {
      create: q.options.map((o) => ({
        optionText: o.optionText.toString().trim(),
        isCorrect: q.questionType === 'short_answer' ? true : Boolean(o.isCorrect),
      })),
    },
  }));
}

function serializeQuiz(quiz) {
  return {
    id: quiz.id,
    subjectId: quiz.subjectId,
    topicId: quiz.topicId,
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitMinutes,
    totalMarks: quiz.totalMarks,
    isPremium: quiz.isPremium,
    questions: quiz.questions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        explanation: q.explanation,
        marks: q.marks,
        options: q.options.map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect })),
      })),
  };
}

// GET /api/admin/quizzes/:id/full - full quiz detail (including correct answers) for editing
router.get('/quizzes/:id/full', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  res.json(serializeQuiz(quiz));
});

// POST /api/admin/quizzes - create a new quiz with its questions/options
router.post('/quizzes', async (req, res) => {
  const { subjectId, topicId, title, timeLimitMinutes, isPremium, questions } = req.body;

  if (!subjectId || !title || !title.trim()) {
    return res.status(400).json({ error: 'subjectId and title are required' });
  }
  const validationError = validateQuestions(questions);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  const questionsCreate = buildQuestionsCreate(questions);
  const totalMarks = questionsCreate.reduce((sum, q) => sum + q.marks, 0);

  const quiz = await prisma.quiz.create({
    data: {
      subjectId,
      topicId: topicId || null,
      title: title.trim(),
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
      isPremium: Boolean(isPremium),
      totalMarks,
      questions: { create: questionsCreate },
    },
    include: { questions: { include: { options: true } } },
  });

  res.status(201).json(serializeQuiz(quiz));
});

// PUT /api/admin/quizzes/:id - replace a quiz's metadata and questions
router.put('/quizzes/:id', async (req, res) => {
  const { subjectId, topicId, title, timeLimitMinutes, isPremium, questions } = req.body;

  if (!subjectId || !title || !title.trim()) {
    return res.status(400).json({ error: 'subjectId and title are required' });
  }
  const validationError = validateQuestions(questions);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const existing = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const questionsCreate = buildQuestionsCreate(questions);
  const totalMarks = questionsCreate.reduce((sum, q) => sum + q.marks, 0);

  // Editing questions in place would require diffing; simplest and most
  // predictable approach is to drop and recreate them inside a transaction.
  // Existing QuizResults for this quiz stay untouched (they reference the
  // quiz, not individual questions), so past scores aren't affected.
  const quiz = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId: req.params.id } });
    return tx.quiz.update({
      where: { id: req.params.id },
      data: {
        subjectId,
        topicId: topicId || null,
        title: title.trim(),
        timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
        isPremium: Boolean(isPremium),
        totalMarks,
        questions: { create: questionsCreate },
      },
      include: { questions: { include: { options: true } } },
    });
  });

  res.json(serializeQuiz(quiz));
});

// DELETE /api/admin/quizzes/:id - remove a quiz and its history
router.delete('/quizzes/:id', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  // QuizResult has no cascade defined on its Quiz relation, so it's cleared
  // explicitly first rather than relying on default FK behavior.
  await prisma.$transaction([
    prisma.quizResult.deleteMany({ where: { quizId: req.params.id } }),
    prisma.quiz.delete({ where: { id: req.params.id } }), // cascades to questions/options
  ]);

  res.status(204).send();
});

module.exports = router;
