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

// GET /api/subjects/:id/topic-notes - approved study notes, grouped by syllabus topic.
// Notes still awaiting review (or rejected) are never returned to students.
router.get('/:id/topic-notes', async (req, res) => {
  const notes = await prisma.topicNote.findMany({
    where: { subjectId: req.params.id, reviewStatus: 'approved' },
    include: { topic: true },
    orderBy: [{ topic: { sequenceOrder: 'asc' } }, { order: 'asc' }],
  });

  const groups = [];
  for (const note of notes) {
    let group = groups.find((g) => g.topic.id === note.topicId);
    if (!group) {
      group = { topic: { id: note.topic.id, title: note.topic.title, code: note.topic.code }, notes: [] };
      groups.push(group);
    }
    group.notes.push({ id: note.id, heading: note.heading, bodyMarkdown: note.bodyMarkdown });
  }
  res.json(groups);
});

module.exports = router;
