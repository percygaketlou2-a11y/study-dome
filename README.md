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
npm run dev                # http://localhost:5173, proxies /api to localhost:4000
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

5. **No real payment processing yet.** The Premium unlock (`/upgrade`) is a manual toggle (`POST /api/billing/upgrade`) standing in for a real payment provider — it grants access with no money changing hands. `backend/src/routes/billing.js` is the one place a real provider's webhook would plug in.

6. **No email sending yet.** Password reset and email verification currently return the link directly in the API response/UI instead of emailing it (see `backend/src/routes/auth.js`) since no email provider is configured. Wire up a real provider (e.g. Resend, SendGrid, SMTP) before relying on these flows with real users.

7. **Build the frontend for production** with `npm run build` in `frontend/` (outputs to `frontend/dist/`) — either serve it from a static host (Vercel/Netlify) pointed at the deployed backend's URL, or serve the built files from the Express backend itself.
