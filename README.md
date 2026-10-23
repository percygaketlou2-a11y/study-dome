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

## Roles, invitations and staff sign-in

There are three kinds of account:

| Role | How it is created | What it can do |
|---|---|---|
| **Student** | Public signup at `/signup` (always a student) | The student site, for their own curriculum |
| **Reviewer** (teacher) | Invitation from an admin | Content Review only (`/admin/content`): check, edit and approve notes and questions |
| **Admin** | Invitation from an admin, or the owner (below) | Everything, and can browse every curriculum from the dashboard |

- **The owner.** The account that registers with the `ADMIN_EMAIL` address (in `.env`) becomes the first admin. It is always an admin and can't be demoted or deleted, so the platform can't be locked out. Register it first when you deploy.
- **Inviting staff.** Admin → Users → *Invite staff*. Enter an email and a role; you get a single-use link (also emailed once email is configured). The link only creates the account for that email, expires after 7 days, and can be revoked. If the admin who issued an invitation is demoted or deleted, their unused invitations stop working. To make an existing student a reviewer or admin, change their role in the same Users list.
- **Staff sign-in.** Teachers and admins sign in at `/admin/login`. Students can't use that form. Staff can also use the normal login.
- **Roles are stored in the database** and checked on every request, so a role change takes effect immediately.

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
- Teachers who review content are invited as **Reviewers**, which gives them this screen and nothing else.

## Security

What the backend enforces:
- **Authentication on every route** except an explicit public list (register, login, verify/reset email, the contact form, the payment callback, health). `backend/tests/security.test.js` walks every registered route to prove it, and proves every `/api/admin/*` route refuses a normal student.
- **Sessions are checked against the database on each request**, so deleting an account, demoting an admin or changing a password takes effect immediately. Changing or resetting a password signs out every older session. Tokens are HS256-only and last 7 days.
- **Passwords** are bcrypt (cost 12), 8 to 72 characters. Login does the same hashing work whether or not the email exists.
- **Emails are stored lowercase**, so a case variant of `ADMIN_EMAIL` can't become a second admin account. Once email sending is configured, staff (admins and reviewers) must also have a verified email.
- **Staff accounts can't be created by public signup**, only by invitation (single-use, tied to one email, expiring), apart from the owner.
- **Rate limiting** on login (failures only, per IP and per account), registration, password reset and the contact form, plus a high general limit. Whole schools share one public IP, so the limits are generous and don't count successful logins.
- **Security headers** (helmet): strict CSP and `nosniff` on the API, `Cache-Control: no-store` on API responses, and CORS limited to your frontend origin.
- **Errors**: clients only ever receive generic messages, never stack traces or database errors. A malformed request can't crash the server.
- **Uploads**: type is checked, the stored extension comes from the verified content type (not the filename), and files are served with `nosniff`.

Checklist before going live:
1. Set `NODE_ENV=production`. The manual Premium test-unlock endpoints are disabled and the startup checks below become fatal.
2. Set a strong `JWT_SECRET` (32+ random characters). The server refuses to start in production without one.
3. Set `FRONTEND_URL` (and `CORS_ORIGINS` if you have more than one frontend) to your real https address.
4. Set `TRUST_PROXY=1` if the API sits behind a host's reverse proxy, or rate limiting will treat every visitor as the same IP.
5. Configure email (`EMAIL_USER`/`EMAIL_PASS`). It is required in production: password resets and email verification go through it, and the server refuses to start without it. In production a reset or verification link is never put in an API response.
6. Run `npm run normalize:emails` once on any database that has accounts from before email normalization.
7. Use Postgres, with a database user that only has access to this app's database.
8. Security headers for the website. When the API server delivers the website (the default in production, see "Going live") it sends this Content-Security-Policy and the other headers itself, and `backend/tests/deploy.test.js` checks the two stay identical. Only if you host the frontend separately do you need to add them there (`frontend/public/_headers` covers Netlify and Cloudflare Pages):

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

## Going live

Study Dome deploys as **one Node service plus one PostgreSQL database**. The same service delivers the website and the API, so there is a single web address, no CORS to configure and no separate frontend host. It works on any host that can run Node (Render, Railway, Fly.io, a VPS, ...).

What you need from the host:
- **Node 22.12 or newer.**
- **A PostgreSQL database** (version 13+), and its connection string.
- **A persistent disk** mounted somewhere (for example `/data`), for uploaded past papers and tutorial images. Without one, uploads vanish on every redeploy.
- **HTTPS** on your domain. Hosts do this for you; it is not something this app does itself.

### Steps

1. Put the code on the host (usually by connecting the GitHub repo).
2. Set the environment variables from `.env.production.example` (see the table below).
3. **Build command:** `npm run build`
   **Start command:** `npm start`
4. Open your address and **register with the `ADMIN_EMAIL` address first**: that account becomes the owner/admin. Everything else is invited from Admin -> Users.

On every start, `npm start` (see `backend/scripts/startProduction.js`) checks the configuration and **refuses to start if it is unsafe**, creates or updates the database tables (it will stop rather than delete data), makes sure the curricula and subjects exist, loads the BGCSE content pack (hidden from students until a reviewer approves each item), then starts the server. All of this is safe to repeat.

| Variable | Required | What it is |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | PostgreSQL connection string, `postgresql://user:password@host:5432/dbname` |
| `JWT_SECRET` | yes | 32+ random characters. Changing it signs everyone out. |
| `FRONTEND_URL` | yes | Your public address, e.g. `https://studydome.example`. Used for emailed links and payments. |
| `BACKEND_URL` | yes | Same address as `FRONTEND_URL` (the API is on the same address). |
| `ADMIN_EMAIL` | yes | The owner account's email. Use an inbox you control. |
| `UPLOADS_DIR` | yes | Folder on the persistent disk, e.g. `/data/uploads` |
| `TRUST_PROXY` | yes | `1` on almost every host, so rate limiting sees real visitor IPs |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | yes | Sends verification and password-reset emails (see "Email" below) |
| `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE`, `DPO_SANDBOX` | for payments | See below |

`PORT` is read from the environment, which hosts set automatically.

### Checks after it is live

- `https://your-address/api/health` shows `{"ok":true}`.
- Registering with `ADMIN_EMAIL` gives you the Admin menu. With email configured, verify that address.
- Upload a test past paper from Admin, redeploy, and confirm it is still there (this proves the disk is persistent).
- Run `npm audit` occasionally and keep `JWT_SECRET` and the database password out of the repo.

### Notes

- **Back up the database** with your host's backup feature. Content-review progress and student accounts live only there.
- **Upgrading from a SQLite development database is not automatic.** The production database starts fresh; development accounts and sample data do not carry over.
- The schema for PostgreSQL is generated from `backend/prisma/schema.prisma` (`npm run prepare:postgres`), so there is still one source of truth. `npm run test:postgres` in `backend/` runs the full test suite against a PostgreSQL database (`TEST_POSTGRES_URL=...`, empty database, it is wiped).
- To serve the frontend from a separate static host instead, set `SERVE_FRONTEND=false`, give that host a rule that forwards `/api/*` and `/uploads/*` to this service, and use the Content-Security-Policy above.
- Payments use DPO Pay and have not been exercised against a live DPO account. Test in DPO's sandbox (`DPO_SANDBOX=true`) before taking real money. Until DPO is configured, `/upgrade` uses a manual unlock that is disabled when `NODE_ENV=production`.

### Connecting email and payment

Both integrations fall back gracefully when unconfigured; filling in the variables above switches them on.


**Email:**

Email is how forgotten passwords are reset and how staff accounts prove they own their address, so production needs it. Use a dedicated Gmail account for Study Dome rather than a personal one.
1. On that Google account, turn on 2-Step Verification: `myaccount.google.com/security`
2. Create an App Password: `myaccount.google.com/apppasswords`. Google shows 16 letters; that is `EMAIL_PASS`. (The normal account password will not work.)
3. Set `EMAIL_USER` (the Gmail address), `EMAIL_PASS` and `EMAIL_FROM` (e.g. `Study Dome <studydome@gmail.com>`) as environment variables on the host.
4. Check it from the host's shell, or locally with the same variables: `cd backend && npm run test:email -- you@example.com`. It says whether the login works and sends a real test message.
5. On every start the server log also says either `[mail] Email is set up` or why the mail server refused it.

Good to know:
- If the mail provider has a problem, signup and password reset still work; the person is told the email could not be sent and can request another from Account settings. Nothing returns a server error.
- Gmail allows roughly 500 emails a day. For more, or for a sender address on your own domain, set `EMAIL_HOST` (and `EMAIL_PORT`, default 587) to any SMTP service (Brevo, Mailgun, Resend, ...) and use its SMTP username and password as `EMAIL_USER` / `EMAIL_PASS`.
- Set `FRONTEND_URL` to the real address, because the links in emails are built from it.
- `ALLOW_NO_EMAIL=true` lets the server start without email for a short private test. Reset and verification links are then written to the server log, not sent, so anyone who can read the log could take over an account. Remove it before real users arrive.
- Whoever registers `ADMIN_EMAIL` first becomes the owner, but with email on they must also verify that inbox before admin features work, so a stranger cannot hold the admin account. Register it yourself straight after deploying. If someone else got there first, "Forgot password" on that address recovers it.

**Payment (DPO Pay):**
1. Register a merchant account at [dpogroup.com](https://www.dpogroup.com) (requires business/ID verification)
2. From the DPO merchant portal, get your `CompanyToken` and the `ServiceType` configured for this product/currency (BWP)
3. Set `DPO_COMPANY_TOKEN` and `DPO_SERVICE_TYPE` in `.env`, keep `DPO_SANDBOX=true` while testing
4. Set `BACKEND_URL` to wherever the backend is actually reachable — DPO redirects the customer's browser to `${BACKEND_URL}/api/billing/dpo/callback` after checkout

Once both are set, `/upgrade` shows a real "Pay P60 with DPO" button that redirects to DPO's hosted checkout; `backend/src/utils/dpo.js` and `backend/src/routes/billing.js` (`/dpo/initiate`, `/dpo/callback`) handle the rest. **This has not been tested against a live DPO account** (none was available while building it) — run it against DPO's sandbox and confirm a full pay → redirect → verify → unlock cycle before trusting it with real payments. If field names or response shapes don't match what DPO actually sends, `backend/src/utils/dpo.js` is the one file to check against DPO's current API reference.
