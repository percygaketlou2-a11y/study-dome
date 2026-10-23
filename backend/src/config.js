// Startup configuration checks and the CORS allow-list.

const WEAK_SECRET_PATTERN = /change-?me|replace-with|dev-only|your-secret|example|placeholder|^secret$|^test/i;
const MIN_SECRET_LENGTH = 32;

function parseList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Browser origins allowed to call the API. CORS_ORIGINS wins; otherwise the
// configured FRONTEND_URL; otherwise the local Vite dev server.
function allowedOrigins(env = process.env) {
  const configured = parseList(env.CORS_ORIGINS).map(toOrigin).filter(Boolean);
  if (configured.length > 0) return configured;
  const frontend = env.FRONTEND_URL ? toOrigin(env.FRONTEND_URL) : null;
  if (frontend) return [frontend];
  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

// Returns { errors, warnings }. Errors must stop the server from starting in
// production; warnings are printed but don't.
function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const production = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET ?? '';

  if (!secret) {
    errors.push('JWT_SECRET is not set.');
  } else if (secret.length < MIN_SECRET_LENGTH || WEAK_SECRET_PATTERN.test(secret)) {
    const message = `JWT_SECRET is weak or a placeholder (use at least ${MIN_SECRET_LENGTH} random characters, e.g. node -e "console.log(require('crypto').randomBytes(48).toString('hex'))").`;
    (production ? errors : warnings).push(message);
  }

  if (production) {
    if (!env.DATABASE_URL) errors.push('DATABASE_URL is not set.');
    else if (env.DATABASE_URL.startsWith('file:')) warnings.push('DATABASE_URL points at a SQLite file; use Postgres in production.');

    if (!env.FRONTEND_URL) errors.push('FRONTEND_URL is not set (needed for emailed links, payment redirects and CORS).');
    else if (!env.FRONTEND_URL.startsWith('https://')) warnings.push('FRONTEND_URL is not https.');

    if (!env.ADMIN_EMAIL) warnings.push('ADMIN_EMAIL is not set, so no account can become an admin.');
    if (!(env.EMAIL_USER && env.EMAIL_PASS)) {
      warnings.push('Email is not configured, so the admin account\'s email cannot be verified and password-reset links are returned in API responses instead of emailed.');
    }
    if (!env.TRUST_PROXY) warnings.push('TRUST_PROXY is not set. Behind a reverse proxy or host, set it (usually 1) or rate limiting will treat every user as one IP.');
    if (env.DPO_SANDBOX === 'true') warnings.push('DPO_SANDBOX is "true" - payments are going to the sandbox.');
  }

  return { errors, warnings };
}

// Express's "trust proxy" setting from TRUST_PROXY: a hop count (1), "true", or
// unset/"false" for none.
function trustProxySetting(env = process.env) {
  const value = (env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

module.exports = { validateEnv, allowedOrigins, trustProxySetting };
