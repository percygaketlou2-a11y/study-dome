const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeCurrentStreak } = require('../utils/streak');

const router = express.Router();

router.use(requireAuth);

// GET /api/leaderboard - every user, ranked by total active days (ties broken
// by current streak), visible to any logged-in user.
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    include: {
      selectedCurriculum: true,
      dailyActivity: { select: { date: true } },
    },
  });

  const ranked = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      curriculum: u.selectedCurriculum?.name ?? null,
      totalActiveDays: u.dailyActivity.length,
      currentStreak: computeCurrentStreak(u.dailyActivity.map((a) => a.date)),
    }))
    .sort((a, b) => b.totalActiveDays - a.totalActiveDays || b.currentStreak - a.currentStreak || a.name.localeCompare(b.name))
    .map((row, i) => ({ rank: i + 1, ...row, isCurrentUser: row.userId === req.userId }));

  res.json(ranked);
});

module.exports = router;
