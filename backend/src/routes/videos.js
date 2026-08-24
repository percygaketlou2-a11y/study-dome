const express = require('express');
const prisma = require('../db');
const { requireAuth, attachPlan } = require('../middleware/auth');
const { parseVideoUrl } = require('../utils/video');

const router = express.Router();

router.use(requireAuth, attachPlan);

// GET /api/videos/:subjectId - video lessons for a subject. Premium videos are
// listed (so students see what's locked) but their embed URL is withheld
// from free-plan users.
router.get('/:subjectId', async (req, res) => {
  const videos = await prisma.video.findMany({
    where: { subjectId: req.params.subjectId },
    orderBy: { createdAt: 'asc' },
  });

  res.json(
    videos.map((v) => {
      const locked = v.isPremium && req.userPlan !== 'premium';
      let embedUrl = null;
      if (!locked) {
        try {
          embedUrl = parseVideoUrl(v.url).embedUrl;
        } catch {
          embedUrl = null;
        }
      }
      return {
        id: v.id,
        title: v.title,
        isPremium: v.isPremium,
        locked,
        embedUrl,
      };
    })
  );
});

module.exports = router;
