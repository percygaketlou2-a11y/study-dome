const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isDpoConfigured, createToken, verifyToken, paymentUrl } = require('../utils/dpo');

const router = express.Router();

const PREMIUM_PRICE_BWP = 60;

function backendUrl() {
  return (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function frontendUrl(path) {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path}`;
}

// GET /api/billing/config - lets the frontend know whether real payment is wired up
router.get('/config', requireAuth, (req, res) => {
  res.json({ dpoConfigured: isDpoConfigured(), price: PREMIUM_PRICE_BWP, currency: 'BWP' });
});

// GET /api/billing/status - the current user's plan
router.get('/status', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { plan: true } });
  res.json({ plan: user.plan });
});

// POST /api/billing/upgrade - manually flips the user to premium.
// Stand-in for real payment for local testing; kept even after DPO is wired
// up so the app is still testable without a real transaction. Every gating
// check only ever reads `user.plan`, so this and the DPO flow below both
// just converge on the same field.
router.post('/upgrade', requireAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { plan: 'premium' } });
  res.json({ plan: user.plan });
});

// POST /api/billing/downgrade - manually returns the user to the free plan.
router.post('/downgrade', requireAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { plan: 'free' } });
  res.json({ plan: user.plan });
});

// POST /api/billing/dpo/initiate - starts a real DPO Pay checkout
router.post('/dpo/initiate', requireAuth, async (req, res) => {
  if (!isDpoConfigured()) {
    return res.status(501).json({ error: 'Payment is not configured yet. Use the manual unlock instead.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const callbackUrl = `${backendUrl()}/api/billing/dpo/callback`;

  let dpo;
  try {
    dpo = await createToken({
      amount: PREMIUM_PRICE_BWP,
      currency: 'BWP',
      reference: `user-${user.id}-${Date.now()}`,
      description: 'Study Dome Premium - one-time unlock',
      redirectUrl: callbackUrl,
      backUrl: callbackUrl,
    });
  } catch (err) {
    console.error('DPO createToken failed:', err);
    return res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }

  if (!dpo.transToken) {
    console.error('DPO createToken returned no token:', dpo.resultExplanation);
    return res.status(502).json({ error: dpo.resultExplanation || 'Could not start payment. Please try again.' });
  }

  await prisma.paymentTransaction.create({
    data: {
      userId: user.id,
      transToken: dpo.transToken,
      amount: PREMIUM_PRICE_BWP,
      currency: 'BWP',
      status: 'pending',
    },
  });

  res.json({ checkoutUrl: paymentUrl(dpo.transToken) });
});

// GET /api/billing/dpo/callback - DPO redirects the customer's browser here
// after checkout. Never trust this alone; always verify server-side.
router.get('/dpo/callback', async (req, res) => {
  const transToken = req.query.TransactionToken || req.query.token;
  if (!transToken) {
    return res.redirect(frontendUrl('/upgrade?payment=error'));
  }

  const transaction = await prisma.paymentTransaction.findUnique({ where: { transToken } });
  if (!transaction) {
    return res.redirect(frontendUrl('/upgrade?payment=error'));
  }

  let result;
  try {
    result = await verifyToken(transToken);
  } catch (err) {
    console.error('DPO verifyToken failed:', err);
    return res.redirect(frontendUrl('/upgrade?payment=error'));
  }

  if (result.approved) {
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'paid', completedAt: new Date() },
      }),
      prisma.user.update({ where: { id: transaction.userId }, data: { plan: 'premium' } }),
    ]);
    return res.redirect(frontendUrl('/upgrade?payment=success'));
  }

  await prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'failed' } });
  res.redirect(frontendUrl('/upgrade?payment=failed'));
});

module.exports = router;
