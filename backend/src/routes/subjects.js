const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/subjects/:id - subject detail, including read-only study notes
router.get('/:id', async (req, res) => {
  const subject = await prisma.subject.findUnique({
    where: { id: req.params.id },
    include: { curriculum: true },
  });

  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  res.json({
    id: subject.id,
    name: subject.name,
    subjectCode: subject.subjectCode,
    category: subject.category,
    notes: subject.notes,
    curriculum: { id: subject.curriculum.id, name: subject.curriculum.name },
  });
});

module.exports = router;
