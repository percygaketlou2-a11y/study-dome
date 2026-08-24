const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadTutorialImage, TUTORIAL_IMAGE_DIR } = require('../utils/upload');

const router = express.Router();

router.use(requireAuth, requireAdmin);

function unlinkImage(url) {
  if (url?.startsWith('/uploads/tutorial-images/')) {
    fs.unlink(path.join(TUTORIAL_IMAGE_DIR, path.basename(url)), () => {}); // best-effort
  }
}

// GET /api/admin/tutorials - every tutorial, for the admin list
router.get('/tutorials', async (req, res) => {
  const tutorials = await prisma.tutorial.findMany({
    include: { subject: { include: { curriculum: true } }, _count: { select: { steps: true } } },
    orderBy: [{ subject: { curriculum: { name: 'asc' } } }, { subject: { name: 'asc' } }, { createdAt: 'desc' }],
  });

  res.json(
    tutorials.map((t) => ({
      id: t.id,
      subjectId: t.subjectId,
      title: t.title,
      isPremium: t.isPremium,
      subject: t.subject.name,
      curriculum: t.subject.curriculum.name,
      stepCount: t._count.steps,
    }))
  );
});

// GET /api/admin/tutorials/:id - a tutorial with its ordered steps, for editing
router.get('/tutorials/:id', async (req, res) => {
  const tutorial = await prisma.tutorial.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!tutorial) {
    return res.status(404).json({ error: 'Tutorial not found' });
  }
  res.json(tutorial);
});

// POST /api/admin/tutorials - create a tutorial shell (steps are added separately)
router.post('/tutorials', async (req, res) => {
  const { subjectId, title, isPremium } = req.body;
  if (!subjectId || !title) {
    return res.status(400).json({ error: 'subjectId and title are required' });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  const tutorial = await prisma.tutorial.create({
    data: { subjectId, title, isPremium: Boolean(isPremium) },
  });

  res.status(201).json(tutorial);
});

// PUT /api/admin/tutorials/:id - edit a tutorial's title/subject/premium flag
router.put('/tutorials/:id', async (req, res) => {
  const existing = await prisma.tutorial.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Tutorial not found' });
  }

  const { subjectId, title, isPremium } = req.body;
  if (!subjectId || !title) {
    return res.status(400).json({ error: 'subjectId and title are required' });
  }

  const tutorial = await prisma.tutorial.update({
    where: { id: req.params.id },
    data: { subjectId, title, isPremium: Boolean(isPremium) },
  });

  res.json(tutorial);
});

// DELETE /api/admin/tutorials/:id - remove a tutorial, its steps and their images
router.delete('/tutorials/:id', async (req, res) => {
  const tutorial = await prisma.tutorial.findUnique({
    where: { id: req.params.id },
    include: { steps: true },
  });
  if (!tutorial) {
    return res.status(404).json({ error: 'Tutorial not found' });
  }

  await prisma.tutorial.delete({ where: { id: req.params.id } });
  tutorial.steps.forEach((s) => unlinkImage(s.imageUrl));

  res.status(204).send();
});

// POST /api/admin/tutorials/:id/steps - add a step (multipart: text, order, image optional)
router.post('/tutorials/:id/steps', uploadTutorialImage, async (req, res) => {
  const tutorial = await prisma.tutorial.findUnique({ where: { id: req.params.id } });
  if (!tutorial) {
    return res.status(404).json({ error: 'Tutorial not found' });
  }

  const { text, order } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const step = await prisma.tutorialStep.create({
    data: {
      tutorialId: req.params.id,
      text,
      order: order ? Number(order) : 0,
      imageUrl: req.file ? `/uploads/tutorial-images/${req.file.filename}` : null,
    },
  });

  res.status(201).json(step);
});

// PUT /api/admin/tutorial-steps/:id - edit a step, optionally replacing its image
router.put('/tutorial-steps/:id', uploadTutorialImage, async (req, res) => {
  const existing = await prisma.tutorialStep.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Step not found' });
  }

  const { text, order } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const data = { text, order: order ? Number(order) : existing.order };
  if (req.file) {
    data.imageUrl = `/uploads/tutorial-images/${req.file.filename}`;
  }

  const step = await prisma.tutorialStep.update({ where: { id: req.params.id }, data });

  if (req.file) {
    unlinkImage(existing.imageUrl);
  }

  res.json(step);
});

// DELETE /api/admin/tutorial-steps/:id
router.delete('/tutorial-steps/:id', async (req, res) => {
  const existing = await prisma.tutorialStep.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Step not found' });
  }

  await prisma.tutorialStep.delete({ where: { id: req.params.id } });
  unlinkImage(existing.imageUrl);

  res.status(204).send();
});

module.exports = router;
