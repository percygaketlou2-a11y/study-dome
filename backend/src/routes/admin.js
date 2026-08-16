const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadPastPaperFiles, UPLOAD_DIR } = require('../utils/upload');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/subjects - every subject across every curriculum, for the notes editor
router.get('/subjects', async (req, res) => {
  const subjects = await prisma.subject.findMany({
    include: { curriculum: true },
    orderBy: [{ curriculum: { name: 'asc' } }, { name: 'asc' }],
  });

  res.json(
    subjects.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      notes: s.notes,
      curriculum: { id: s.curriculum.id, name: s.curriculum.name },
    }))
  );
});

// PATCH /api/admin/subjects/:id/notes - admin-only edit of a subject's study notes
router.patch('/subjects/:id/notes', async (req, res) => {
  const { notes } = req.body;

  const subject = await prisma.subject.update({
    where: { id: req.params.id },
    data: { notes: typeof notes === 'string' ? notes : null },
  });

  res.json({ id: subject.id, notes: subject.notes });
});

// GET /api/admin/quizzes - every quiz, for toggling premium access
router.get('/quizzes', async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    include: { subject: { include: { curriculum: true } } },
    orderBy: [{ subject: { curriculum: { name: 'asc' } } }, { subject: { name: 'asc' } }],
  });

  res.json(
    quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      isPremium: q.isPremium,
      subject: q.subject.name,
      curriculum: q.subject.curriculum.name,
    }))
  );
});

// PATCH /api/admin/quizzes/:id/premium - admin-only toggle of a quiz's premium flag
router.patch('/quizzes/:id/premium', async (req, res) => {
  const { isPremium } = req.body;
  const quiz = await prisma.quiz.update({
    where: { id: req.params.id },
    data: { isPremium: Boolean(isPremium) },
  });
  res.json({ id: quiz.id, isPremium: quiz.isPremium });
});

// GET /api/admin/past-papers - every past paper, for toggling premium access
router.get('/past-papers', async (req, res) => {
  const papers = await prisma.pastPaper.findMany({
    include: { subject: { include: { curriculum: true } } },
    orderBy: [{ subject: { curriculum: { name: 'asc' } } }, { subject: { name: 'asc' } }, { year: 'desc' }],
  });

  res.json(
    papers.map((p) => ({
      id: p.id,
      title: p.title ?? `${p.year} Paper ${p.paperNumber}`,
      year: p.year,
      isPremium: p.isPremium,
      subject: p.subject.name,
      curriculum: p.subject.curriculum.name,
    }))
  );
});

// PATCH /api/admin/past-papers/:id/premium - admin-only toggle of a paper's premium flag
router.patch('/past-papers/:id/premium', async (req, res) => {
  const { isPremium } = req.body;
  const paper = await prisma.pastPaper.update({
    where: { id: req.params.id },
    data: { isPremium: Boolean(isPremium) },
  });
  res.json({ id: paper.id, isPremium: paper.isPremium });
});

// POST /api/admin/past-papers - upload a new past paper (multipart: examFile required,
// markingSchemeFile optional)
router.post('/past-papers', uploadPastPaperFiles, async (req, res) => {
  const { subjectId, year, season, paperNumber, variant, title, isPremium } = req.body;
  const examFile = req.files?.examFile?.[0];
  const markingSchemeFile = req.files?.markingSchemeFile?.[0];

  if (!subjectId || !year || !paperNumber || !examFile) {
    return res.status(400).json({ error: 'subjectId, year, paperNumber and an exam file are required' });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  const paper = await prisma.pastPaper.create({
    data: {
      subjectId,
      year: Number(year),
      season: season || null,
      paperNumber: Number(paperNumber),
      variant: variant ? Number(variant) : 1,
      title: title || null,
      isPremium: isPremium === 'true' || isPremium === true,
      fileUrl: `/uploads/past-papers/${examFile.filename}`,
      markingSchemeUrl: markingSchemeFile ? `/uploads/past-papers/${markingSchemeFile.filename}` : null,
    },
  });

  res.status(201).json(paper);
});

// DELETE /api/admin/past-papers/:id - remove a past paper and its uploaded files
router.delete('/past-papers/:id', async (req, res) => {
  const paper = await prisma.pastPaper.findUnique({ where: { id: req.params.id } });
  if (!paper) {
    return res.status(404).json({ error: 'Past paper not found' });
  }

  await prisma.pastPaper.delete({ where: { id: req.params.id } });

  for (const url of [paper.fileUrl, paper.markingSchemeUrl]) {
    if (url?.startsWith('/uploads/past-papers/')) {
      const filePath = path.join(UPLOAD_DIR, path.basename(url));
      fs.unlink(filePath, () => {}); // best-effort; ignore missing files
    }
  }

  res.status(204).send();
});

module.exports = router;
