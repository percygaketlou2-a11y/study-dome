const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { todayKey } = require('../utils/streak');

const router = express.Router();

router.use(requireAuth);

// A structured question is only shown once every one of its parts is approved;
// a question with a rejected or unreviewed part would be incomplete.
const VISIBLE = { parts: { some: {}, every: { reviewStatus: 'approved' } } };

// GET /api/structured/:subjectId - exam-style questions for a subject. Mark
// schemes are deliberately NOT included; they're only released by /reveal
// after the student has attempted every part.
router.get('/:subjectId', async (req, res) => {
  const questions = await prisma.structuredQuestion.findMany({
    where: { subjectId: req.params.subjectId, ...VISIBLE },
    include: { topic: true, parts: { orderBy: { order: 'asc' } } },
    orderBy: [{ topic: { sequenceOrder: 'asc' } }, { key: 'asc' }],
  });

  res.json(
    questions.map((q) => ({
      id: q.id,
      topic: q.topic.title,
      paperStyle: q.paperStyle,
      totalMarks: q.totalMarks,
      stem: q.stem,
      parts: q.parts.map((p) => ({ id: p.id, label: p.label, prompt: p.prompt, marks: p.marks })),
    }))
  );
});

// POST /api/structured/:id/reveal - body { answers: { [partId]: string } }.
// Releases the mark scheme once every part has an answer, so students attempt
// the question before seeing how it is marked. Students self-mark; nothing is
// auto-graded.
router.post('/:id/reveal', async (req, res) => {
  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers are required' });
  }

  const question = await prisma.structuredQuestion.findFirst({
    where: { id: req.params.id, ...VISIBLE },
    include: { parts: { orderBy: { order: 'asc' } } },
  });
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const unanswered = question.parts.filter((p) => !(answers[p.id] ?? '').toString().trim());
  if (unanswered.length > 0) {
    return res.status(400).json({
      error: `Attempt every part before viewing the mark scheme (missing: ${unanswered.map((p) => (p.label ? `(${p.label})` : 'your answer')).join(', ')})`,
    });
  }

  // Attempting a structured question counts as study activity for the streak.
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId: req.userId, date: todayKey() } },
    update: {},
    create: { userId: req.userId, date: todayKey() },
  });

  res.json({
    parts: question.parts.map((p) => ({
      id: p.id,
      label: p.label,
      marks: p.marks,
      answer: answers[p.id].toString().trim(),
      markScheme: p.markScheme,
    })),
  });
});

module.exports = router;
