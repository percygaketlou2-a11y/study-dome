const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseVideoUrl } = require('../utils/video');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/videos - every video lesson, for the admin table
router.get('/videos', async (req, res) => {
  const videos = await prisma.video.findMany({
    include: { subject: { include: { curriculum: true } } },
    orderBy: [{ subject: { curriculum: { name: 'asc' } } }, { subject: { name: 'asc' } }, { createdAt: 'desc' }],
  });

  res.json(
    videos.map((v) => ({
      id: v.id,
      subjectId: v.subjectId,
      title: v.title,
      url: v.url,
      isPremium: v.isPremium,
      subject: v.subject.name,
      curriculum: v.subject.curriculum.name,
    }))
  );
});

// POST /api/admin/videos - add a video lesson (YouTube/Vimeo link only)
router.post('/videos', async (req, res) => {
  const { subjectId, title, url, isPremium } = req.body;

  if (!subjectId || !title || !url) {
    return res.status(400).json({ error: 'subjectId, title and url are required' });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  try {
    parseVideoUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const video = await prisma.video.create({
    data: { subjectId, title, url, isPremium: Boolean(isPremium) },
  });

  res.status(201).json(video);
});

// PUT /api/admin/videos/:id - edit a video lesson
router.put('/videos/:id', async (req, res) => {
  const existing = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const { subjectId, title, url, isPremium } = req.body;
  if (!subjectId || !title || !url) {
    return res.status(400).json({ error: 'subjectId, title and url are required' });
  }

  try {
    parseVideoUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const video = await prisma.video.update({
    where: { id: req.params.id },
    data: { subjectId, title, url, isPremium: Boolean(isPremium) },
  });

  res.json(video);
});

// DELETE /api/admin/videos/:id
router.delete('/videos/:id', async (req, res) => {
  const existing = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Video not found' });
  }

  await prisma.video.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

module.exports = router;
