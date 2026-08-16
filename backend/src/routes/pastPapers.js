const express = require('express');
const prisma = require('../db');
const { requireAuth, attachPlan } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, attachPlan);

// GET /api/past-papers/:subjectId - past papers for a subject, with marking-scheme
// availability. Premium papers are listed (so students can see what's locked)
// but their file/marking-scheme URLs are withheld from free-plan users.
router.get('/:subjectId', async (req, res) => {
  const papers = await prisma.pastPaper.findMany({
    where: { subjectId: req.params.subjectId },
    orderBy: [{ year: 'desc' }, { paperNumber: 'asc' }],
  });

  res.json(
    papers.map((p) => {
      const locked = p.isPremium && req.userPlan !== 'premium';
      return {
        id: p.id,
        year: p.year,
        season: p.season,
        paperNumber: p.paperNumber,
        variant: p.variant,
        title: p.title,
        isPremium: p.isPremium,
        locked,
        fileUrl: locked ? null : p.fileUrl,
        hasMarkingScheme: Boolean(p.markingSchemeUrl),
        markingSchemeUrl: locked ? null : p.markingSchemeUrl,
      };
    })
  );
});

module.exports = router;
