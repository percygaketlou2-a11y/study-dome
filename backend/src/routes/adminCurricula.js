const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Deletes any QuizResult rows for quizzes under the given subject ids first,
// since QuizResult has no cascade defined on its Quiz relation.
async function clearQuizResultsForSubjects(subjectIds) {
  const quizzes = await prisma.quiz.findMany({ where: { subjectId: { in: subjectIds } }, select: { id: true } });
  if (quizzes.length > 0) {
    await prisma.quizResult.deleteMany({ where: { quizId: { in: quizzes.map((q) => q.id) } } });
  }
}

// GET /api/admin/curricula - every curriculum with its subject count
router.get('/curricula', async (req, res) => {
  const curricula = await prisma.curriculum.findMany({
    include: { _count: { select: { subjects: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(
    curricula.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      subjectCount: c._count.subjects,
    }))
  );
});

// POST /api/admin/curricula - create a curriculum
router.post('/curricula', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const existing = await prisma.curriculum.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return res.status(409).json({ error: 'A curriculum with this name already exists' });
  }

  const curriculum = await prisma.curriculum.create({
    data: { name: name.trim(), description: description?.trim() || null },
  });
  res.status(201).json(curriculum);
});

// PATCH /api/admin/curricula/:id - edit a curriculum's name/description
router.patch('/curricula/:id', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const curriculum = await prisma.curriculum.update({
    where: { id: req.params.id },
    data: { name: name.trim(), description: description?.trim() || null },
  });
  res.json(curriculum);
});

// DELETE /api/admin/curricula/:id - remove a curriculum and everything under it
router.delete('/curricula/:id', async (req, res) => {
  const curriculum = await prisma.curriculum.findUnique({ where: { id: req.params.id } });
  if (!curriculum) {
    return res.status(404).json({ error: 'Curriculum not found' });
  }

  const subjects = await prisma.subject.findMany({ where: { curriculumId: req.params.id }, select: { id: true } });
  await clearQuizResultsForSubjects(subjects.map((s) => s.id));

  // Cascades to Levels, Subjects, and (via Subject) Topics/Quizzes/Questions/
  // Options/PastPapers - all explicitly marked onDelete: Cascade in the schema.
  await prisma.curriculum.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// GET /api/admin/curricula/:id/subjects - subjects for one curriculum (admin picker)
router.get('/curricula/:id/subjects', async (req, res) => {
  const subjects = await prisma.subject.findMany({
    where: { curriculumId: req.params.id },
    orderBy: { name: 'asc' },
  });
  res.json(subjects);
});

// POST /api/admin/subjects - create a subject under a curriculum
router.post('/subjects', async (req, res) => {
  const { curriculumId, name, category, subjectCode } = req.body;
  if (!curriculumId || !name || !name.trim()) {
    return res.status(400).json({ error: 'curriculumId and name are required' });
  }

  const curriculum = await prisma.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum) {
    return res.status(404).json({ error: 'Curriculum not found' });
  }

  const existing = await prisma.subject.findUnique({
    where: { curriculumId_name: { curriculumId, name: name.trim() } },
  });
  if (existing) {
    return res.status(409).json({ error: 'This curriculum already has a subject with this name' });
  }

  const subject = await prisma.subject.create({
    data: {
      curriculumId,
      name: name.trim(),
      category: category?.trim() || null,
      subjectCode: subjectCode?.trim() || null,
    },
  });
  res.status(201).json(subject);
});

// PATCH /api/admin/subjects/:id - edit a subject's name/category/code
router.patch('/subjects/:id', async (req, res) => {
  const { name, category, subjectCode } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const subject = await prisma.subject.update({
    where: { id: req.params.id },
    data: {
      name: name.trim(),
      category: category?.trim() || null,
      subjectCode: subjectCode?.trim() || null,
    },
  });
  res.json(subject);
});

// DELETE /api/admin/subjects/:id - remove a subject and everything under it
router.delete('/subjects/:id', async (req, res) => {
  const subject = await prisma.subject.findUnique({ where: { id: req.params.id } });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  await clearQuizResultsForSubjects([req.params.id]);

  // Cascades to Topics/Quizzes/Questions/Options/PastPapers.
  await prisma.subject.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

module.exports = router;
