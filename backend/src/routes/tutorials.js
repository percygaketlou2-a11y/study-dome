const express = require('express');
const prisma = require('../db');
const { requireAuth, attachPlan } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, attachPlan);

// GET /api/tutorials/:subjectId - tutorials for a subject. Premium tutorials are
// listed (so students see what's locked) but their steps are withheld from
// free-plan users, same as premium quiz questions.
router.get('/:subjectId', async (req, res) => {
  const tutorials = await prisma.tutorial.findMany({
    where: { subjectId: req.params.subjectId },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json(
    tutorials.map((t) => {
      const locked = t.isPremium && req.userPlan !== 'premium';
      return {
        id: t.id,
        title: t.title,
        isPremium: t.isPremium,
        locked,
        steps: locked
          ? []
          : t.steps.map((s) => ({ id: s.id, order: s.order, text: s.text, imageUrl: s.imageUrl })),
      };
    })
  );
});

module.exports = router;
