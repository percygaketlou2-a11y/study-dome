const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/payments - every payment transaction, for the admin payments page
router.get('/payments', async (req, res) => {
  const transactions = await prisma.paymentTransaction.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    transactions.map((t) => ({
      id: t.id,
      userName: t.user.name,
      userEmail: t.user.email,
      provider: t.provider,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }))
  );
});

module.exports = router;
