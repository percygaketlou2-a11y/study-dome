const express = require('express');
const prisma = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { generateToken, hashToken } = require('../utils/tokens');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { isString, normalizeEmail, isValidEmail, passwordProblem, cleanText } = require('../utils/validate');
const { isStaff, isOwnerEmail } = require('../utils/roles');
const { isEmailConfigured, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15min
const MAX_NAME_LENGTH = 100;
const INVALID_INVITE = 'This invitation is invalid or has expired';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    selectedCurriculumId: user.selectedCurriculumId,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
  };
}

// Response for a brand-new account (public signup or an accepted invitation).
async function respondWithNewAccount(res, user, rawVerifyToken) {
  const token = signToken(user.id);

  if (isEmailConfigured()) {
    await sendVerificationEmail(user.email, rawVerifyToken);
    return res.status(201).json({ token, user: publicUser(user), emailSent: true });
  }

  // No email provider is configured, so the verification link is handed
  // back directly instead of being emailed. Never return tokens to the
  // client once real email sending is active (see the branch above).
  res.status(201).json({ token, user: publicUser(user), devVerifyLink: `/verify-email?token=${rawVerifyToken}` });
}

// Public signup. This ALWAYS creates a student - the one exception is the
// owner, whose address (ADMIN_EMAIL) bootstraps the first admin. Every other
// staff account comes from an invitation.
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
      role: isOwnerEmail(email) ? 'admin' : 'student',
      verifyTokenHash: hash,
      verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      termsAcceptedAt: new Date(),
    },
  });

  await respondWithNewAccount(res, user, raw);
});

// Checks credentials. Always does the same hashing work whether or not the
// account exists, so response time doesn't reveal which emails are registered.
async function authenticate(body) {
  const email = normalizeEmail(body.email);
  if (!email || !isString(body.password)) return { badRequest: true };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(body.password, user?.passwordHash);
  return { user: user && valid ? user : null };
}

async function finishLogin(res, user) {
  // The owner is always an admin; this only repairs the record (e.g. after a
  // manual database edit), it never demotes anyone.
  if (isOwnerEmail(user.email) && user.role !== 'admin') {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}

// Student sign-in (staff can use it too).
router.post('/login', async (req, res) => {
  const { badRequest, user } = await authenticate(req.body);
  if (badRequest) return res.status(400).json({ error: 'email and password are required' });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  await finishLogin(res, user);
});

// Staff sign-in, used by the separate /admin/login page. Students can't sign in
// here: they get the same "invalid email or password" as a wrong password, so
// this form can't be used to find out which emails belong to students or staff.
router.post('/staff-login', async (req, res) => {
  const { badRequest, user } = await authenticate(req.body);
  if (badRequest) return res.status(400).json({ error: 'email and password are required' });
  if (!user || !(isStaff(user.role) || isOwnerEmail(user.email))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await finishLogin(res, user);
});

// An invitation is usable only while it is unused, unrevoked, unexpired - and
// only while the admin who issued it is still an admin. Removing or demoting an
// admin therefore cancels everything they left outstanding.
async function findUsableInvitation(token) {
  if (!isString(token) || !token) return null;
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { invitedBy: { select: { role: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) return null;
  if (invitation.invitedBy?.role !== 'admin') return null;
  return invitation;
}

// POST /api/auth/invite-info - lets the accept-invite page show who the
// invitation is for (the token is sent in the body, never in a URL we'd log).
router.post('/invite-info', async (req, res) => {
  const invitation = await findUsableInvitation(req.body.token);
  if (!invitation) {
    return res.status(404).json({ error: INVALID_INVITE });
  }
  res.json({ email: invitation.email, role: invitation.role });
});

// POST /api/auth/accept-invite - creates the staff account the invitation was for.
// The email and role come from the invitation, not from the request.
router.post('/accept-invite', async (req, res) => {
  const { token, password, acceptedTerms } = req.body;
  const name = cleanText(req.body.name, MAX_NAME_LENGTH);

  if (!name || !isString(token) || !isString(password)) {
    return res.status(400).json({ error: 'A name and a password are required' });
  }
  const problem = passwordProblem(password);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  if (acceptedTerms !== true) {
    return res.status(400).json({ error: 'You must accept the Terms & Conditions and Privacy Policy to register' });
  }

  const invitation = await findUsableInvitation(token);
  if (!invitation) {
    return res.status(400).json({ error: INVALID_INVITE });
  }
  if (await prisma.user.findUnique({ where: { email: invitation.email } })) {
    return res.status(409).json({ error: 'An account with this email already exists. Ask an admin to change your role instead.' });
  }

  const passwordHash = await hashPassword(password);
  const { raw, hash } = generateToken();

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // Claim the invitation first; if two requests race, only one can win.
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('INVITE_ALREADY_USED');

      return tx.user.create({
        data: {
          name,
          email: invitation.email,
          passwordHash,
          role: invitation.role,
          verifyTokenHash: hash,
          verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
          termsAcceptedAt: new Date(),
        },
      });
    });
  } catch (err) {
    if (err.message === 'INVITE_ALREADY_USED') return res.status(400).json({ error: INVALID_INVITE });
    throw err;
  }

  await respondWithNewAccount(res, user, raw);
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
