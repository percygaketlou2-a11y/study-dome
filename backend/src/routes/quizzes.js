const express = require('express');
const prisma = require('../db');
const { requireAuth, attachPlan } = require('../middleware/auth');
const { todayKey } = require('../utils/streak');

const router = express.Router();

router.use(requireAuth, attachPlan);

// GET /api/quizzes/:subjectId - list quizzes for a subject
router.get('/:subjectId', async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { subjectId: req.params.subjectId },
    include: { topic: true, _count: { select: { questions: true } } },
  });

  res.json(
    quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      topic: q.topic?.title ?? null,
      timeLimitMinutes: q.timeLimitMinutes,
      totalMarks: q.totalMarks,
      questionCount: q._count.questions,
      isPremium: q.isPremium,
      locked: q.isPremium && req.userPlan !== 'premium',
    }))
  );
});

// GET /api/quizzes/take/:quizId - fetch questions without revealing correct answers
router.get('/take/:quizId', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.quizId },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
  });

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  if (quiz.isPremium && req.userPlan !== 'premium') {
    return res.status(403).json({ error: 'This quiz is only available on the Premium plan' });
  }

  res.json({
    id: quiz.id,
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitMinutes,
    totalMarks: quiz.totalMarks,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      marks: q.marks,
      options:
        q.questionType === 'short_answer'
          ? null
          : q.options.map((o) => ({ id: o.id, optionText: o.optionText })),
    })),
  });
});

// POST /api/quizzes/submit - grade answers, save result, return feedback
// answers: { [questionId]: string } - an optionId for multiple_choice/true_false,
// or free text for short_answer.
router.post('/submit', async (req, res) => {
  const { quizId, answers } = req.body;

  if (!quizId || !answers) {
    return res.status(400).json({ error: 'quizId and answers are required' });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
  });

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  if (quiz.isPremium && req.userPlan !== 'premium') {
    return res.status(403).json({ error: 'This quiz is only available on the Premium plan' });
  }

  const feedback = quiz.questions.map((q) => {
    const correctOption = q.options.find((o) => o.isCorrect);
    const submitted = (answers[q.id] ?? '').toString().trim();

    let isCorrect;
    let submittedAnswer;
    if (q.questionType === 'short_answer') {
      isCorrect = submitted.toLowerCase() === correctOption.optionText.trim().toLowerCase();
      submittedAnswer = submitted;
    } else {
      const submittedOption = q.options.find((o) => o.id === submitted);
      isCorrect = submittedOption?.isCorrect ?? false;
      submittedAnswer = submittedOption?.optionText ?? '';
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      marks: q.marks,
      submittedAnswer,
      correctAnswer: correctOption.optionText,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const marksAwarded = feedback.reduce((sum, f, i) => sum + (f.isCorrect ? quiz.questions[i].marks : 0), 0);
  const totalMarks = quiz.totalMarks;
  const score = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0;

  const result = await prisma.quizResult.create({
    data: {
      userId: req.userId,
      quizId: quiz.id,
      score,
      marksAwarded,
      totalMarks,
    },
  });

  // First quiz of the day for this user counts as one active day toward
  // their streak and leaderboard standing.
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId: req.userId, date: todayKey() } },
    update: {},
    create: { userId: req.userId, date: todayKey() },
  });

  res.json({
    resultId: result.id,
    score,
    marksAwarded,
    totalMarks,
    correctCount: feedback.filter((f) => f.isCorrect).length,
    totalQuestions: quiz.questions.length,
    feedback,
  });
});

module.exports = router;
