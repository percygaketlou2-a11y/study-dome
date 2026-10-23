const express = require('express');
const prisma = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { generateToken, hashToken } = require('../utils/tokens');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { isString, normalizeEmail, isValidEmail, passwordProblem, cleanText } = require('../utils/validate');
const { isEmailConfigured, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15min
const MAX_NAME_LENGTH = 100;

function isAdminEmail(email) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return Boolean(adminEmail) && email === adminEmail;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    selectedCurriculumId: user.selectedCurriculumId,
    isAdmin: user.isAdmin,
    plan: user.plan,
    emailVerified: user.emailVerified,
  };
}

router.post('/register', async (req, res) => {
  const { password, acceptedTerms } = req.body;
  const name = cleanText(req.body.name, MAX_NAME_LENGTH);
  const email = normalizeEmail(req.body.email);

  if (!name || !isValidEmail(email) || !isString(password)) {
    return res.status(400).json({ error: 'A name, a valid email and a password are required' });
  }
  const problem = passwordProblem(password);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  if (acceptedTerms !== true) {
    return res.status(400).json({ error: 'You must accept the Terms & Conditions and Privacy Policy to register' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await hashPassword(password);
  const { raw, hash } = generateToken();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: isAdminEmail(email),
      verifyTokenHash: hash,
      verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      termsAcceptedAt: new Date(),
    },
  });

  const token = signToken(user.id);

  if (isEmailConfigured()) {
    await sendVerificationEmail(user.email, raw);
    return res.status(201).json({ token, user: publicUser(user), emailSent: true });
  }

  // No email provider is configured, so the verification link is handed
  // back directly instead of being emailed. Never return tokens to the
  // client once real email sending is active (see the branch above).
  res.status(201).json({ token, user: publicUser(user), devVerifyLink: `/verify-email?token=${raw}` });
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !isString(password)) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  // Always do the same amount of hashing work, whether or not the account
  // exists, so response time doesn't reveal which emails are registered.
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Keep the admin flag in sync in case ADMIN_EMAIL was set/changed after signup.
  if (isAdminEmail(user.email) !== user.isAdmin) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: isAdminEmail(user.email) },
    });
  }

  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/resend-verification - regenerate a verification link for the current user
router.post('/resend-verification', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (user.emailVerified) {
    return res.json({ alreadyVerified: true });
  }

  const { raw, hash } = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyTokenHash: hash, verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
  });

  if (isEmailConfigured()) {
    await sendVerificationEmail(user.email, raw);
    return res.json({ emailSent: true });
  }

  res.json({ devVerifyLink: `/verify-email?token=${raw}` });
});

// POST /api/auth/verify-email - consume a verification token
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!isString(token) || !token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const user = await prisma.user.findFirst({ where: { verifyTokenHash: hashToken(token) } });
  if (!user || !user.verifyTokenExpiresAt || user.verifyTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: 'This verification link is invalid or has expired' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyTokenHash: null, verifyTokenExpiresAt: null },
  });

  res.json({ verified: true });
});

// POST /api/auth/forgot-password - issue a password reset link
router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return a generic message so the response shape alone doesn't
  // confirm whether an account exists for this email.
  const message = 'If an account exists for that email, a reset link has been issued.';
  if (!user) {
    return res.json({ message });
  }

  const { raw, hash } = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: hash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  if (isEmailConfigured()) {
    await sendPasswordResetEmail(user.email, raw);
    return res.json({ message });
  }

  res.json({ message, devResetLink: `/reset-password?token=${raw}` });
});

// POST /api/auth/reset-password - consume a reset token and set a new password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!isString(token) || !token || !isString(newPassword)) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const user = await prisma.user.findFirst({ where: { resetTokenHash: hashToken(token) } });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }

  // passwordChangedAt invalidates every session issued before now, which is the
  // point of resetting a password after a suspected compromise.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });

  res.json({ token: signToken(updated.id), user: publicUser(updated) });
});

module.exports = router;
