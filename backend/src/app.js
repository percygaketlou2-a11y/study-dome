// Must be first: makes errors thrown inside async route handlers reach the
// error handler below instead of crashing the process.
require('./utils/asyncErrors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { allowedOrigins, trustProxySetting, shouldServeFrontend, FRONTEND_CSP } = require('./config');
const { UploadError, UPLOADS_ROOT } = require('./utils/upload');
const limits = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const curriculaRoutes = require('./routes/curricula');
const quizzesRoutes = require('./routes/quizzes');
const pastPapersRoutes = require('./routes/pastPapers');
const leaderboardRoutes = require('./routes/leaderboard');
const subjectsRoutes = require('./routes/subjects');
const adminRoutes = require('./routes/admin');
const adminQuizzesRoutes = require('./routes/adminQuizzes');
const adminCurriculaRoutes = require('./routes/adminCurricula');
const adminUsersRoutes = require('./routes/adminUsers');
const adminPaymentsRoutes = require('./routes/adminPayments');
const adminVideosRoutes = require('./routes/adminVideos');
const videosRoutes = require('./routes/videos');
const adminTutorialsRoutes = require('./routes/adminTutorials');
const tutorialsRoutes = require('./routes/tutorials');
const structuredRoutes = require('./routes/structured');
const adminContentRoutes = require('./routes/adminContent');
const contactRoutes = require('./routes/contact');
const adminContactRoutes = require('./routes/adminContact');
const adminInvitationsRoutes = require('./routes/adminInvitations');
const billingRoutes = require('./routes/billing');

const app = express();
const origins = allowedOrigins();

app.disable('x-powered-by');
app.set('trust proxy', trustProxySetting());

// Uploaded papers and tutorial images. Served before the API-wide headers
// because the frontend embeds them (PDF viewer iframe, <img>): they must be
// framable by the frontend and loadable cross-origin, but never sniffed into
// another content type. Dotfiles and directory listings are refused.
app.use(
  '/uploads',
  helmet({
    // Only frame-ancestors is wanted here. A blanket default-src could stop the
    // browser's built-in PDF viewer from rendering a paper, hence the opt-out.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc,
        frameAncestors: ["'self'", ...origins],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false, // frame-ancestors above replaces it and allows the frontend origin
  }),
  express.static(UPLOADS_ROOT, { dotfiles: 'deny', index: false })
);

// API responses are JSON, so the browser is told not to run or frame any of it.
// (Scoped to /api so it doesn't apply to the website's own pages, below.)
app.use(
  '/api',
  helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  })
);

// Only the configured frontend origin(s) may read API responses from a browser.
// Requests with no Origin header (same-origin, curl, server-to-server) pass through.
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || origins.includes(origin));
    },
  })
);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store'); // account data must never be cached by a browser or shared proxy
  next();
});
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Rate limits (see middleware/rateLimit.js). Mounted before the routers.
app.use('/api', limits.apiLimiter);
app.use('/api/auth/login', limits.loginIpLimiter, limits.loginAccountLimiter);
app.use('/api/auth/staff-login', limits.loginIpLimiter, limits.loginAccountLimiter);
app.use('/api/auth/invite-info', limits.inviteLimiter);
app.use('/api/auth/accept-invite', limits.inviteLimiter);
app.use('/api/auth/register', limits.registerLimiter);
app.use('/api/auth/forgot-password', limits.passwordResetLimiter);
app.use('/api/auth/reset-password', limits.passwordResetLimiter);
app.use('/api/contact', limits.contactLimiter);

// Content Review is the one admin area reviewers (teachers) may use. It MUST be mounted
// before the admin-only routers below: each of those applies requireAdmin to every path
// under /api/admin, so anything mounted after them is unreachable for a reviewer.
// (tests/security.test.js checks this for every admin route.)
app.use('/api/admin/content', adminContentRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/curricula', curriculaRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/past-papers', pastPapersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminQuizzesRoutes);
app.use('/api/admin', adminCurriculaRoutes);
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin', adminPaymentsRoutes);
app.use('/api/admin', adminVideosRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/admin', adminTutorialsRoutes);
app.use('/api/tutorials', tutorialsRoutes);
app.use('/api/structured', structuredRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminContactRoutes);
app.use('/api/admin', adminInvitationsRoutes);
app.use('/api/billing', billingRoutes);

// The website itself. When the built frontend is present (production), this same
// server delivers it, so the site and its API share one address: no CORS, no
// proxy to configure, and the same-origin Content-Security-Policy below fits exactly.
// Skipped in development, where Vite serves the frontend.
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.join(__dirname, '..', '..', 'frontend', 'dist');

if (shouldServeFrontend(process.env, fs.existsSync(path.join(frontendDist, 'index.html')))) {
  const pageHeaders = [
    helmet({
      contentSecurityPolicy: false, // set explicitly below
      crossOriginResourcePolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
    (req, res, next) => {
      res.set('Content-Security-Policy', FRONTEND_CSP);
      res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
      next();
    },
  ];

  // Built files have content-hashed names, so they can be cached for good;
  // the HTML page must always be re-checked so a new deploy is picked up.
  app.use(
    pageHeaders,
    express.static(frontendDist, {
      index: false,
      setHeaders(res, filePath) {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.set('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    })
  );

  // Any other page address is a route inside the single-page app.
  app.get(/^\/(?!api(\/|$)|uploads(\/|$)).*/, pageHeaders, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Anything unmatched - including refused dotfiles under /uploads - gets a plain JSON 404
// rather than Express's default page, which names the framework.
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Last line of defence. Clients only ever get one of these generic messages -
// never a stack trace, a database error, or a query - whatever went wrong.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof UploadError) return res.status(400).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large' : 'The upload was not accepted';
    return res.status(400).json({ error: message });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err.name === 'PrismaClientValidationError') {
    console.error('Rejected a request with invalid field types:', err.message.split('\n').pop());
    return res.status(400).json({ error: 'Invalid request' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
