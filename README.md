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
