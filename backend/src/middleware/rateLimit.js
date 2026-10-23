const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { normalizeEmail } = require('../utils/validate');

// Limits are per client IP. Many students at one school share a single public
// IP, so the limits that matter for login only count FAILED attempts - a
// classroom signing in at the start of a lesson never trips them - and the
// general API limit is set high enough for that same shared-IP case.
//
// Behind a reverse proxy, set TRUST_PROXY so req.ip is the real client and not
// the proxy (otherwise every user would share one counter).

const MINUTE = 60 * 1000;

function build({ windowMs, limit, skipSuccessfulRequests = false, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // The test suite hammers the API from one IP; tests that exercise the
    // limiters switch this back on explicitly.
    skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
    },
  });
}

const apiMax = Number(process.env.RATE_LIMIT_API_MAX) || 3000;

module.exports = {
  // Everything under /api.
  apiLimiter: build({ windowMs: 15 * MINUTE, limit: apiMax }),

  // Failed logins from one IP, across all accounts.
  loginIpLimiter: build({ windowMs: 15 * MINUTE, limit: 20, skipSuccessfulRequests: true }),

  // Failed logins from one IP against one account - the brute-force guard. Keyed on
  // IP + email (not email alone) so a stranger can't lock a student out of their own account.
  loginAccountLimiter: build({
    windowMs: 15 * MINUTE,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${normalizeEmail(req.body?.email) ?? ''}`,
  }),

  registerLimiter: build({ windowMs: 60 * MINUTE, limit: 60 }),

  // Looking up or accepting an invitation (tokens are 256-bit, so this is a guard, not the defence).
  inviteLimiter: build({ windowMs: 15 * MINUTE, limit: 20 }),
  passwordResetLimiter: build({ windowMs: 15 * MINUTE, limit: 10 }),
  contactLimiter: build({ windowMs: 60 * MINUTE, limit: 5 }),
};
