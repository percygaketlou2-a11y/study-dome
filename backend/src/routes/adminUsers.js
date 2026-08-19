const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/users - every user, for the admin user-management page
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    include: { selectedCurriculum: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: u.isAdmin,
      plan: u.plan,
      emailVerified: u.emailVerified,
      curriculum: u.selectedCurriculum?.name ?? null,
      createdAt: u.createdAt,
    }))
  );
});

// PATCH /api/admin/users/:id - toggle a user's admin access and/or plan
router.patch('/users/:id', async (req, res) => {
  const { isAdmin, plan } = req.body;

  if (req.params.id === req.userId && isAdmin === false) {
    return res.status(400).json({ error: "You can't remove your own admin access" });
  }
  if (plan !== undefined && plan !== 'free' && plan !== 'premium') {
    return res.status(400).json({ error: 'plan must be "free" or "premium"' });
  }

  const data = {};
  if (isAdmin !== undefined) data.isAdmin = Boolean(isAdmin);
  if (plan !== undefined) data.plan = plan;

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ id: user.id, isAdmin: user.isAdmin, plan: user.plan });
});

// DELETE /api/admin/users/:id - remove a user and their history
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "You can't delete your own account" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // QuizResult has no cascade defined on its User relation, so it's cleared
  // explicitly first; DailyActivity and PaymentTransaction do cascade.
  await prisma.$transaction([
    prisma.quizResult.deleteMany({ where: { userId: req.params.id } }),
    prisma.user.delete({ where: { id: req.params.id } }),
  ]);

  res.status(204).send();
});

module.exports = router;
