const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/billing/status - the current user's plan
router.get('/status', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { plan: true } });
  res.json({ plan: user.plan });
});

// POST /api/billing/upgrade - manually flips the user to premium.
// No payment provider is wired up yet: this is a stand-in for a future
// Stripe (or similar) webhook, which would call this same update once a
// payment actually succeeds. Every other route only ever reads `user.plan`,
// so swapping in real billing later means changing what calls this, not the
// gating logic itself.
router.post('/upgrade', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { plan: 'premium' } });
  res.json({ plan: user.plan });
});

// POST /api/billing/downgrade - manually returns the user to the free plan.
router.post('/downgrade', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { plan: 'free' } });
  res.json({ plan: user.plan });
});

module.exports = router;
