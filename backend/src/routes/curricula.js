const express = require('express');
const prisma = require('../db');

const router = express.Router();

// GET /api/curricula - list all curricula (used during onboarding)
router.get('/', async (req, res) => {
  const curricula = await prisma.curriculum.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(curricula);
});

// GET /api/curricula/:id/subjects - subjects for a specific curriculum
router.get('/:id/subjects', async (req, res) => {
  const subjects = await prisma.subject.findMany({
    where: { curriculumId: req.params.id },
    orderBy: { name: 'asc' },
  });
  res.json(subjects);
});

// GET /api/curricula/:id/levels - academic tiers for a specific curriculum
router.get('/:id/levels', async (req, res) => {
  const levels = await prisma.level.findMany({
    where: { curriculumId: req.params.id },
    orderBy: { name: 'asc' },
  });
  res.json(levels);
});

module.exports = router;
