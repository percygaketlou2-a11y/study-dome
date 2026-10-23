# Study Dome

Exam prep platform for JC, BGCSE, IGCSE, A-Levels, IB and IEB students — curricula, subjects, interactive quizzes, past papers, study notes, streaks/leaderboard, and a premium (one-time-unlock) tier.

## Stack

- **Backend:** Node.js, Express, Prisma ORM, JWT auth. SQLite in dev; swap to Postgres for production (see below).
- **Frontend:** Vite, React, TypeScript, Tailwind CSS, Zustand, React Query.

## Project structure

```
backend/     Express API (src/), Prisma schema + seed data (prisma/), Jest test suite (tests/)
frontend/    Vite/React app (src/)
```

## Local setup

**Backend:**
```bash
cd backend
npm install
cp .env.example .env      # then fill in real values
npx prisma generate
npx prisma db push        # creates the SQLite database from the schema
node prisma/seed.js       # populates curricula/subjects/quizzes/past-papers
npm run dev                # http://localhost:4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api and /uploads to localhost:4000
```

**Tests** (backend only, isolated SQLite test DB, auto-seeded):
```bash
cd backend
npm test
```

## Admin access

Whichever account registers with the email set as `ADMIN_EMAIL` (in `.env`) is automatically granted admin rights — no separate admin flow. The admin can then:
- Write study notes per subject (`/admin/notes`)
- Upload past-paper PDFs and toggle which quizzes/papers require Premium (`/admin/access`)

## Content packs and teacher review

Syllabus content (subjects, topics, specific objectives, study notes, multiple-choice questions and exam-style structured questions) is loaded from JSON content packs. The BGCSE pack lives in `backend/prisma/content/bgcse/`.

```bash
cd backend
npm run import:content            # imports the BGCSE pack
npm run import:content -- <dir>   # imports another pack directory
```

- Items attach to the existing subjects (matched by code, then by name, treating "&" and "and" alike). Notes become topic notes, multiple-choice questions become one practice quiz per topic, and structured questions are shown as self-marked exam-style questions.
- The import is idempotent: items that already exist are skipped, so re-running it never overwrites review progress or edits. Run it once against the production database after deploying.
- Everything imports as **not reviewed and hidden from students**. Open **Admin -> Content Review** (`/admin/content`) to check each item, record corrections, edit it, and set it to **Approved** to publish it. A structured question goes live only when every one of its parts is approved.
- Quizzes that come from a content pack are edited in Content Review, not the Quiz Builder (the builder replaces all of a quiz's questions, which would reset their review status).
- Reviewers need an admin account to use the review screen.

## Security

What the backend enforces:
- **Authentication on every route** except an explicit public list (register, login, verify/reset email, the contact form, the payment callback, health). `backend/tests/security.test.js` walks every registered route to prove it, and proves every `/api/admin/*` route refuses a normal student.
- **Sessions are checked against the database on each request**, so deleting an account, demoting an admin or changing a password takes effect immediately. Changing or resetting a password signs out every older session. Tokens are HS256-only and last 7 days.
- **Passwords** are bcrypt (cost 12), 8 to 72 characters. Login does the same hashing work whether or not the email exists.
- **Emails are stored lowercase**, so a case variant of `ADMIN_EMAIL` can't become a second admin account. Once email sending is configured, an admin must also have a verified email.
- **Rate limiting** on login (failures only, per IP and per account), registration, password reset and the contact form, plus a high general limit. Whole schools share one public IP, so the limits are generous and don't count successful logins.
- **Security headers** (helmet): strict CSP and `nosniff` on the API, `Cache-Control: no-store` on API responses, and CORS limited to your frontend origin.
- **Errors**: clients only ever receive generic messages, never stack traces or database errors. A malformed request can't crash the server.
- **Uploads**: type is checked, the stored extension comes from the verified content type (not the filename), and files are served with `nosniff`.

Checklist before going live:
1. Set `NODE_ENV=production`. The manual Premium test-unlock endpoints are disabled and the startup checks below become fatal.
2. Set a strong `JWT_SECRET` (32+ random characters). The server refuses to start in production without one.
3. Set `FRONTEND_URL` (and `CORS_ORIGINS` if you have more than one frontend) to your real https address.
4. Set `TRUST_PROXY=1` if the API sits behind a host's reverse proxy, or rate limiting will treat every visitor as the same IP.
5. Configure email (`EMAIL_USER`/`EMAIL_PASS`) so the admin email can be verified and password-reset links are emailed instead of returned in the API response.
6. Run `npm run normalize:emails` once on any database that has accounts from before email normalization.
7. Use Postgres, with a database user that only has access to this app's database.
8. Add security headers to the frontend host. `frontend/public/_headers` covers Netlify and Cloudflare Pages. A Content-Security-Policy depends on your backend domain, so it is not shipped; this is a starting point:

```
default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com;
style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:;
frame-src 'self' https://www.youtube.com https://www.google.com https://player.vimeo.com;
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```
This assumes the host proxies `/api` and `/uploads` to the backend (as the Vite dev server does); if the API is on another domain, add it to `connect-src`, `img-src` and `frame-src`.

This policy was tested against the production build in a Chromium browser: the app, Google Fonts, API calls, Vimeo and YouTube embeds, the PDF viewer iframe and inline progress-bar styles all work, while injected scripts, inline `<style>`, `eval`, external images/frames/requests, a rewritten `<base>` and cross-site form posts are blocked. Testing found one thing to know about: a visitor's first YouTube view bounces the embed through `www.google.com`, so that origin has to be in `frame-src`. Without it the first video fails and then works after a refresh. Re-test with `Content-Security-Policy-Report-Only` if you change hosts, and again if you add a new kind of embed or third-party script.

Known trade-offs:
- The login token is kept in browser local storage (simple, and immune to CSRF), so an XSS bug would expose it. The app has no `dangerouslySetInnerHTML` and renders note text as plain React elements. Moving to httpOnly cookies would need CSRF protection too.
- Uploaded past-paper PDFs are served by URL without a login check. Filenames are random and only released to students allowed to see them, but anyone who is given a link can open it.
- `npm audit` still reports a few issues in dev-only tooling (`nodemon`, `jest`). They never run in production; fixing them needs major-version upgrades of those tools.

## Before deploying to production

A few things are set up for local development and need attention before this goes live:

1. **Switch the database to Postgres.** In `backend/prisma/schema.prisma`, change the datasource `provider` from `"sqlite"` to `"postgresql"`, point `DATABASE_URL` at a real Postgres instance, then run `npx prisma db push` (or set up proper migrations with `npx prisma migrate dev`) against it. SQLite works locally but most hosting platforms don't persist local disk files across deploys/restarts.

2. **Persistent file storage for uploads.** Past-paper PDFs are currently saved to `backend/uploads/past-papers/` on local disk (see `backend/src/utils/upload.js`). This needs either a persistent volume on whatever host you use, or migrating to object storage (S3-compatible) before real files are uploaded — otherwise uploads vanish on redeploy.

3. **Set a real `JWT_SECRET`.** The `.env.example` has a placeholder; generate a real random secret for production and never commit it.

4. **Restrict CORS.** `backend/src/app.js` currently allows all origins (`cors()` with no options). Once the frontend's production URL is known, lock this down to that origin.

5. **Payment (DPO Pay) is wired up but needs your real credentials.** See "Connecting email and payment" below. Until `DPO_COMPANY_TOKEN`/`DPO_SERVICE_TYPE` are set, `/upgrade` falls back to a manual toggle (`POST /api/billing/upgrade`) that grants Premium with no money changing hands — fine for testing, not for real users. The DPO integration (`backend/src/utils/dpo.js`) is built against DPO's documented API but has not been exercised against a live DPO account — test carefully in DPO's sandbox (`DPO_SANDBOX=true`) before going live.

6. **Email (Gmail) is wired up but needs your real credentials.** See "Connecting email and payment" below. Until `EMAIL_USER`/`EMAIL_PASS` are set, password reset and email verification fall back to returning the link directly in the API response/UI instead of emailing it (see `backend/src/routes/auth.js`).

7. **Build the frontend for production** with `npm run build` in `frontend/` (outputs to `frontend/dist/`) — either serve it from a static host (Vercel/Netlify) pointed at the deployed backend's URL, or serve the built files from the Express backend itself.

8. **Connecting email and payment.** Both integrations exist in the code and fall back gracefully when unconfigured — filling in the env vars below is what switches them on.

   **Email (Gmail):**
   1. On the Google account you want to send from, turn on 2-Step Verification: `myaccount.google.com/security`
   2. Create an App Password: `myaccount.google.com/apppasswords` (choose "Mail")
   3. Set `EMAIL_USER` (the Gmail address) and `EMAIL_PASS` (the 16-character app password, not the normal account password) in `.env`
   4. Set `FRONTEND_URL` to wherever the frontend is actually reachable, so links in emails resolve correctly

   Once both are set, `/api/auth/register`, `/api/auth/forgot-password`, and `/api/auth/resend-verification` send real emails instead of returning the link in the response. Gmail's free sending limit is ~500/day, fine for early usage — move to a dedicated transactional provider (Resend, SendGrid) if that becomes a bottleneck.

   **Payment (DPO Pay):**
   1. Register a merchant account at [dpogroup.com](https://www.dpogroup.com) (requires business/ID verification)
   2. From the DPO merchant portal, get your `CompanyToken` and the `ServiceType` configured for this product/currency (BWP)
   3. Set `DPO_COMPANY_TOKEN` and `DPO_SERVICE_TYPE` in `.env`, keep `DPO_SANDBOX=true` while testing
   4. Set `BACKEND_URL` to wherever the backend is actually reachable — DPO redirects the customer's browser to `${BACKEND_URL}/api/billing/dpo/callback` after checkout

   Once both are set, `/upgrade` shows a real "Pay P60 with DPO" button that redirects to DPO's hosted checkout; `backend/src/utils/dpo.js` and `backend/src/routes/billing.js` (`/dpo/initiate`, `/dpo/callback`) handle the rest. **This has not been tested against a live DPO account** (none was available while building it) — run it against DPO's sandbox and confirm a full pay → redirect → verify → unlock cycle before trusting it with real payments. If field names or response shapes don't match what DPO actually sends, `backend/src/utils/dpo.js` is the one file to check against DPO's current API reference.

9. **`/uploads` needs the same routing as `/api` in production.** Locally, Vite's dev proxy forwards both `/api/*` and `/uploads/*` to the backend (see `frontend/vite.config.ts`) so uploaded past-paper PDFs render correctly. If the frontend and backend are deployed as separate services, whatever serves the frontend (or a reverse proxy in front of both) needs an equivalent rule for `/uploads/*` — otherwise uploaded files will 404 (or worse, silently serve the frontend's own HTML shell instead of the PDF, which is what happens with Vite's dev-only SPA fallback).
