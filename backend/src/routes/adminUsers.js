const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ROLES, isOwnerEmail } = require('../utils/roles');

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
      role: u.role,
      isOwner: isOwnerEmail(u.email),
      plan: u.plan,
      emailVerified: u.emailVerified,
      curriculum: u.selectedCurriculum?.name ?? null,
      createdAt: u.createdAt,
    }))
  );
});

// PATCH /api/admin/users/:id - change a user's role and/or plan
router.patch('/users/:id', async (req, res) => {
  const { role, plan } = req.body;

  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  }
  if (plan !== undefined && plan !== 'free' && plan !== 'premium') {
    return res.status(400).json({ error: 'plan must be "free" or "premium"' });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (role !== undefined && role !== target.role) {
    if (isOwnerEmail(target.email)) {
      return res.status(400).json({ error: "The owner account is always an admin and can't be changed" });
    }
    if (target.id === req.userId) {
      return res.status(400).json({ error: "You can't change your own role" });
    }
  }

  const data = {};
  if (role !== undefined) data.role = role;
  if (plan !== undefined) data.plan = plan;

  const user = await prisma.user.update({ where: { id: target.id }, data });
  res.json({ id: user.id, role: user.role, plan: user.plan });
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
  if (isOwnerEmail(user.email)) {
    return res.status(400).json({ error: "The owner account can't be deleted" });
  }

  // QuizResult has no cascade defined on its User relation, so it's cleared
  // explicitly first; DailyActivity and PaymentTransaction do cascade.
  // Invitations this user sent are kept but stop working (see auth.js).
  await prisma.$transaction([
    prisma.quizResult.deleteMany({ where: { userId: req.params.id } }),
    prisma.user.delete({ where: { id: req.params.id } }),
  ]);

  res.status(204).send();
});

module.exports = router;
