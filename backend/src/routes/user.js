const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeCurrentStreak } = require('../utils/streak');
const { generateToken } = require('../utils/tokens');

const router = express.Router();

router.use(requireAuth);

// PATCH /api/user/curriculum - onboarding: set the user's selected curriculum
router.patch('/curriculum', async (req, res) => {
  const { curriculumId } = req.body;
  if (!curriculumId) {
    return res.status(400).json({ error: 'curriculumId is required' });
  }

  const curriculum = await prisma.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum) {
    return res.status(404).json({ error: 'Curriculum not found' });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { selectedCurriculumId: curriculumId },
  });

  res.json({ id: user.id, name: user.name, email: user.email, selectedCurriculumId: user.selectedCurriculumId });
});

// GET /api/user/dashboard - user info, curriculum, subjects, last 5 quiz results
router.get('/dashboard', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { selectedCurriculum: { include: { subjects: true } } },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const recentResults = await prisma.quizResult.findMany({
    where: { userId: req.userId },
    orderBy: { completedAt: 'desc' },
    take: 5,
    include: { quiz: { include: { subject: { include: { curriculum: true } } } } },
  });

  const activity = await prisma.dailyActivity.findMany({
    where: { userId: req.userId },
    select: { date: true },
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
    currentStreak: computeCurrentStreak(activity.map((a) => a.date)),
    totalActiveDays: activity.length,
    curriculum: user.selectedCurriculum
      ? { id: user.selectedCurriculum.id, name: user.selectedCurriculum.name }
      : null,
    subjects: user.selectedCurriculum ? user.selectedCurriculum.subjects : [],
    recentQuizzes: recentResults.map((r) => ({
      id: r.id,
      quizId: r.quizId,
      quizTitle: r.quiz.title,
      subject: r.quiz.subject.name,
      level: r.quiz.subject.curriculum.name,
      score: r.score,
      completedAt: r.completedAt,
    })),
  });
});

// PATCH /api/user/profile - change display name
router.patch('/profile', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data: { name: name.trim() } });
  res.json({ id: user.id, name: user.name });
});

// PATCH /api/user/email - change email, requires current password, resets verification
router.patch('/email', async (req, res) => {
  const { newEmail, password } = req.body;
  if (!newEmail || !password) {
    return res.status(400).json({ error: 'newEmail and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== user.id) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const { raw, hash } = generateToken();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email: newEmail,
      emailVerified: false,
      verifyTokenHash: hash,
      verifyTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  res.json({ email: updated.email, devVerifyLink: `/verify-email?token=${raw}` });
});

// PATCH /api/user/password - change password, requires current password
router.patch('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ updated: true });
});

module.exports = router;
