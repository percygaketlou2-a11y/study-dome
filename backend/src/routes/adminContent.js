const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

const REVIEW_STATUSES = ['not_reviewed', 'approved', 'approve_with_edits', 'rejected'];
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const OPTIONS_IN_ORDER = { orderBy: [{ order: 'asc' }, { id: 'asc' }] };

// Validates and extracts the review fields shared by notes, MCQs and
// structured parts. Anything not supplied is left untouched.
function parseReview(body) {
  const data = {};
  if (body.reviewStatus !== undefined) {
    if (!REVIEW_STATUSES.includes(body.reviewStatus)) {
      return { error: `reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}` };
    }
    data.reviewStatus = body.reviewStatus;
    data.reviewedAt = new Date();
  }
  if (body.corrections !== undefined) data.corrections = String(body.corrections).trim() || null;
  if (body.reviewerName !== undefined) data.reviewerName = String(body.reviewerName).trim() || null;
  return { data };
}

function requireSubjectId(req, res) {
  if (!req.query.subjectId) {
    res.status(400).json({ error: 'subjectId is required' });
    return null;
  }
  return String(req.query.subjectId);
}

function emptyTally() {
  return { total: 0, approved: 0, approve_with_edits: 0, rejected: 0, not_reviewed: 0 };
}

function addToTally(map, subjectId, status) {
  if (!map.has(subjectId)) map.set(subjectId, emptyTally());
  const t = map.get(subjectId);
  t.total += 1;
  t[status] = (t[status] ?? 0) + 1;
}

// GET /api/admin/content/overview - review progress per subject (the
// "Start Here" progress table of the review workbook).
router.get('/content/overview', async (req, res) => {
  const [subjects, notes, questions, parts, topics] = await Promise.all([
    prisma.subject.findMany({
      where: { topics: { some: { key: { not: null } } } },
      include: { curriculum: true },
      orderBy: [{ curriculum: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.topicNote.findMany({ select: { subjectId: true, reviewStatus: true } }),
    prisma.question.findMany({
      where: { key: { not: null } },
      select: { reviewStatus: true, quiz: { select: { subjectId: true } } },
    }),
    prisma.structuredPart.findMany({
      select: { reviewStatus: true, question: { select: { subjectId: true } } },
    }),
    prisma.topic.findMany({
      where: { key: { not: null } },
      select: { subjectId: true, _count: { select: { objectives: true } } },
    }),
  ]);

  const noteTally = new Map();
  const mcqTally = new Map();
  const partTally = new Map();
  notes.forEach((n) => addToTally(noteTally, n.subjectId, n.reviewStatus));
  questions.forEach((q) => addToTally(mcqTally, q.quiz.subjectId, q.reviewStatus));
  parts.forEach((p) => addToTally(partTally, p.question.subjectId, p.reviewStatus));

  const topicCount = new Map();
  const objectiveCount = new Map();
  topics.forEach((t) => {
    topicCount.set(t.subjectId, (topicCount.get(t.subjectId) ?? 0) + 1);
    objectiveCount.set(t.subjectId, (objectiveCount.get(t.subjectId) ?? 0) + t._count.objectives);
  });

  res.json(
    subjects.map((s) => ({
      id: s.id,
      name: s.name,
      subjectCode: s.subjectCode,
      curriculum: s.curriculum.name,
      syllabusYear: s.syllabusYear,
      assessment: s.assessment,
      topics: topicCount.get(s.id) ?? 0,
      objectives: objectiveCount.get(s.id) ?? 0,
      notes: noteTally.get(s.id) ?? emptyTally(),
      mcqs: mcqTally.get(s.id) ?? emptyTally(),
      structuredParts: partTally.get(s.id) ?? emptyTally(),
    }))
  );
});

// ---------------------------------------------------------------- notes

function serializeNote(n) {
  return {
    id: n.id,
    key: n.key,
    heading: n.heading,
    bodyMarkdown: n.bodyMarkdown,
    topic: { id: n.topic.id, title: n.topic.title, code: n.topic.code },
    objectiveCodes: n.objectives.map((o) => o.syllabusCode).filter(Boolean),
    reviewStatus: n.reviewStatus,
    corrections: n.corrections,
    reviewerName: n.reviewerName,
    reviewedAt: n.reviewedAt,
  };
}

const NOTE_INCLUDE = { topic: true, objectives: { select: { syllabusCode: true } } };

router.get('/content/notes', async (req, res) => {
  const subjectId = requireSubjectId(req, res);
  if (!subjectId) return;

  const notes = await prisma.topicNote.findMany({
    where: { subjectId },
    include: NOTE_INCLUDE,
    orderBy: [{ topic: { sequenceOrder: 'asc' } }, { order: 'asc' }],
  });
  res.json(notes.map(serializeNote));
});

router.patch('/content/notes/:id', async (req, res) => {
  const existing = await prisma.topicNote.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const review = parseReview(req.body);
  if (review.error) return res.status(400).json({ error: review.error });
  const data = review.data;

  if (req.body.heading !== undefined) {
    if (!String(req.body.heading).trim()) return res.status(400).json({ error: 'heading cannot be empty' });
    data.heading = String(req.body.heading).trim();
  }
  if (req.body.bodyMarkdown !== undefined) {
    if (!String(req.body.bodyMarkdown).trim()) return res.status(400).json({ error: 'note text cannot be empty' });
    data.bodyMarkdown = String(req.body.bodyMarkdown);
  }

  const note = await prisma.topicNote.update({ where: { id: req.params.id }, data, include: NOTE_INCLUDE });
  res.json(serializeNote(note));
});

// ----------------------------------------------------------------- MCQs

const MCQ_INCLUDE = {
  quiz: { include: { topic: true } },
  options: OPTIONS_IN_ORDER,
  objectives: { select: { syllabusCode: true } },
};

function serializeMcq(q) {
  return {
    id: q.id,
    key: q.key,
    topic: q.quiz.topic?.title ?? null,
    questionText: q.questionText,
    difficulty: q.difficulty,
    assessmentObjective: q.assessmentObjective,
    explanation: q.explanation,
    marks: q.marks,
    options: q.options.map((o, i) => ({ id: o.id, letter: OPTION_LETTERS[i], optionText: o.optionText, isCorrect: o.isCorrect })),
    objectiveCodes: q.objectives.map((o) => o.syllabusCode).filter(Boolean),
    reviewStatus: q.reviewStatus,
    suggestedCorrectOption: q.suggestedCorrectOption,
    corrections: q.corrections,
    reviewerName: q.reviewerName,
    reviewedAt: q.reviewedAt,
  };
}

router.get('/content/mcqs', async (req, res) => {
  const subjectId = requireSubjectId(req, res);
  if (!subjectId) return;

  const questions = await prisma.question.findMany({
    where: { key: { not: null }, quiz: { subjectId } },
    include: MCQ_INCLUDE,
    orderBy: [{ quiz: { topic: { sequenceOrder: 'asc' } } }, { order: 'asc' }],
  });
  res.json(questions.map(serializeMcq));
});

router.patch('/content/mcqs/:id', async (req, res) => {
  const existing = await prisma.question.findFirst({
    where: { id: req.params.id, key: { not: null } },
    include: { options: OPTIONS_IN_ORDER },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const review = parseReview(req.body);
  if (review.error) return res.status(400).json({ error: review.error });
  const data = review.data;

  if (req.body.suggestedCorrectOption !== undefined) {
    const letter = String(req.body.suggestedCorrectOption).trim().toUpperCase();
    if (letter && !OPTION_LETTERS.slice(0, existing.options.length).includes(letter)) {
      return res.status(400).json({ error: 'suggestedCorrectOption must be one of the question\'s option letters' });
    }
    data.suggestedCorrectOption = letter || null;
  }

  if (req.body.questionText !== undefined) {
    if (!String(req.body.questionText).trim()) return res.status(400).json({ error: 'question text cannot be empty' });
    data.questionText = String(req.body.questionText).trim();
  }
  if (req.body.explanation !== undefined) {
    data.explanation = String(req.body.explanation).trim() || null;
  }

  const optionEdits = req.body.options ?? [];
  const optionIds = new Set(existing.options.map((o) => o.id));
  for (const edit of optionEdits) {
    if (!optionIds.has(edit.id)) return res.status(400).json({ error: 'Option does not belong to this question' });
    if (!String(edit.optionText ?? '').trim()) return res.status(400).json({ error: 'Every option needs text' });
  }
  const correctOptionId = req.body.correctOptionId;
  if (correctOptionId !== undefined && !optionIds.has(correctOptionId)) {
    return res.status(400).json({ error: 'correctOptionId does not belong to this question' });
  }

  const question = await prisma.$transaction(async (tx) => {
    for (const edit of optionEdits) {
      await tx.option.update({ where: { id: edit.id }, data: { optionText: String(edit.optionText).trim() } });
    }
    if (correctOptionId !== undefined) {
      await tx.option.updateMany({ where: { questionId: existing.id }, data: { isCorrect: false } });
      await tx.option.update({ where: { id: correctOptionId }, data: { isCorrect: true } });
    }
    return tx.question.update({ where: { id: existing.id }, data, include: MCQ_INCLUDE });
  });

  res.json(serializeMcq(question));
});

// ----------------------------------------------------------- structured

const STRUCTURED_INCLUDE = {
  topic: true,
  parts: { orderBy: { order: 'asc' } },
  objectives: { select: { syllabusCode: true } },
};

function serializeStructured(q) {
  return {
    id: q.id,
    key: q.key,
    topic: q.topic.title,
    paperStyle: q.paperStyle,
    assessmentObjective: q.assessmentObjective,
    totalMarks: q.totalMarks,
    stem: q.stem,
    objectiveCodes: q.objectives.map((o) => o.syllabusCode).filter(Boolean),
    parts: q.parts.map((p) => ({
      id: p.id,
      label: p.label,
      prompt: p.prompt,
      marks: p.marks,
      markScheme: p.markScheme,
      reviewStatus: p.reviewStatus,
      corrections: p.corrections,
      reviewerName: p.reviewerName,
      reviewedAt: p.reviewedAt,
    })),
  };
}

router.get('/content/structured', async (req, res) => {
  const subjectId = requireSubjectId(req, res);
  if (!subjectId) return;

  const questions = await prisma.structuredQuestion.findMany({
    where: { subjectId },
    include: STRUCTURED_INCLUDE,
    orderBy: [{ topic: { sequenceOrder: 'asc' } }, { key: 'asc' }],
  });
  res.json(questions.map(serializeStructured));
});

router.patch('/content/structured/:id', async (req, res) => {
  const existing = await prisma.structuredQuestion.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Question not found' });
  }
  if (!String(req.body.stem ?? '').trim()) {
    return res.status(400).json({ error: 'stem cannot be empty' });
  }
  const question = await prisma.structuredQuestion.update({
    where: { id: req.params.id },
    data: { stem: String(req.body.stem).trim() },
    include: STRUCTURED_INCLUDE,
  });
  res.json(serializeStructured(question));
});

router.patch('/content/structured-parts/:id', async (req, res) => {
  const existing = await prisma.structuredPart.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Part not found' });
  }

  const review = parseReview(req.body);
  if (review.error) return res.status(400).json({ error: review.error });
  const data = review.data;

  if (req.body.prompt !== undefined) {
    if (!String(req.body.prompt).trim()) return res.status(400).json({ error: 'prompt cannot be empty' });
    data.prompt = String(req.body.prompt).trim();
  }
  if (req.body.markScheme !== undefined) {
    if (!String(req.body.markScheme).trim()) return res.status(400).json({ error: 'mark scheme cannot be empty' });
    data.markScheme = String(req.body.markScheme).trim();
  }
  if (req.body.marks !== undefined) {
    const marks = Number(req.body.marks);
    if (!Number.isInteger(marks) || marks < 1) return res.status(400).json({ error: 'marks must be a whole number of at least 1' });
    data.marks = marks;
  }

  const question = await prisma.$transaction(async (tx) => {
    await tx.structuredPart.update({ where: { id: existing.id }, data });
    // Keep the question's total in step with its parts.
    const { _sum } = await tx.structuredPart.aggregate({ where: { questionId: existing.questionId }, _sum: { marks: true } });
    return tx.structuredQuestion.update({
      where: { id: existing.questionId },
      data: { totalMarks: _sum.marks ?? 0 },
      include: STRUCTURED_INCLUDE,
    });
  });

  res.json(serializeStructured(question));
});

// ------------------------------------------------------------ topic map

// GET /api/admin/content/topic-map?subjectId= - the syllabus (units, topics,
// specific objectives) with a flag for which objectives already have content.
router.get('/content/topic-map', async (req, res) => {
  const subjectId = requireSubjectId(req, res);
  if (!subjectId) return;

  const topics = await prisma.topic.findMany({
    where: { subjectId, key: { not: null } },
    orderBy: { sequenceOrder: 'asc' },
    include: {
      objectives: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          syllabusCode: true,
          text: true,
          _count: { select: { notes: true, questions: true, structuredQuestions: true } },
        },
      },
      _count: { select: { notes: true, structuredQuestions: true } },
      quizzes: { select: { questions: { where: { key: { not: null } }, select: { id: true } } } },
    },
  });

  res.json(
    topics.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      unitCode: t.unitCode,
      unitName: t.unitName,
      noteCount: t._count.notes,
      mcqCount: t.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0),
      structuredCount: t._count.structuredQuestions,
      objectives: t.objectives.map((o) => ({
        id: o.id,
        syllabusCode: o.syllabusCode,
        text: o.text,
        covered: o._count.notes + o._count.questions + o._count.structuredQuestions > 0,
      })),
    }))
  );
});

module.exports = router;
