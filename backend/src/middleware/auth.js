const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { isEmailConfigured } = require('../utils/mailer');
const { isStaff } = require('../utils/roles');

// Pinned so a token can never choose its own algorithm (e.g. "none").
const JWT_ALGORITHM = 'HS256';
const TOKEN_LIFETIME = '7d';

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: TOKEN_LIFETIME });
}

// Verifies the token AND loads the account fresh from the database on every
// request, so:
//  - a deleted account's token stops working immediately,
//  - a token issued before the last password change/reset is rejected (changing
//    a password signs out anyone who had stolen the old session), and
//  - role/plan changes take effect straight away rather than waiting for the
//    token to expire.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (typeof payload.userId !== 'string') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, plan: true, emailVerified: true, passwordChangedAt: true },
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return res.status(401).json({ error: 'Your password was changed. Please log in again.' });
  }

  req.userId = user.id;
  req.authUser = user;
  next();
}

// Shared by the two staff guards below.
//
// Once email sending is configured, staff must also have a verified email.
// Without that, whoever registered (or switched to) a privileged address first
// would hold staff rights without ever proving they own the inbox.
function staffEmailProblem(user) {
  if (isEmailConfigured() && !user.emailVerified) {
    return 'Verify your email address to use staff tools';
  }
  return null;
}

// Must run after requireAuth. Admins only.
function requireAdmin(req, res, next) {
  const user = req.authUser;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const problem = staffEmailProblem(user);
  if (problem) return res.status(403).json({ error: problem });
  next();
}

// Must run after requireAuth. Admins and reviewers (e.g. Content Review).
function requireStaff(req, res, next) {
  const user = req.authUser;
  if (!user || !isStaff(user.role)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  const problem = staffEmailProblem(user);
  if (problem) return res.status(403).json({ error: problem });
  next();
}

// Must run after requireAuth. Exposes the caller's plan on req.userPlan so
// routes can check premium access without re-querying the user.
function attachPlan(req, res, next) {
  req.userPlan = req.authUser?.plan ?? 'free';
  next();
}

module.exports = { requireAuth, requireAdmin, requireStaff, attachPlan, signToken };
