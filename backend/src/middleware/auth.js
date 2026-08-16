const jwt = require('jsonwebtoken');
const prisma = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Must run after requireAuth. Re-checks isAdmin on every request rather than
// trusting the JWT, so revoking admin access takes effect immediately.
async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Must run after requireAuth. Loads the caller's plan onto req.userPlan so
// routes can check premium access without re-querying the user each time.
async function attachPlan(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { plan: true } });
  req.userPlan = user?.plan ?? 'free';
  next();
}

module.exports = { requireAuth, requireAdmin, attachPlan };
