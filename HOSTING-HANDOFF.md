# Study Dome: hosting handoff

For whoever is putting Study Dome online. About 30 minutes. The full details are in `README.md` under "Going live".

## What you are hosting

One Node.js service (it serves the website and the API on one address) plus one PostgreSQL database.

## What you need

- **Node 22.12 or newer**
- **PostgreSQL 13 or newer** (any managed Postgres: Render, Railway, Supabase, Neon, a VPS...)
- **A persistent disk** mounted on the service (for example at `/data`). Uploaded past papers and images live here; without it they disappear on every redeploy.
- **HTTPS on the domain.** Most hosts do this automatically.
- **A Gmail account** for sending email (see "Email" below).

## Steps

1. Put this code on the host (connect the GitHub repo, or upload the zip).
2. Set the environment variables listed in `.env.production.example` (the owner will give you a filled-in copy, `study-dome.env.production`, which already contains the secret `JWT_SECRET`). Change `FRONTEND_URL` and `BACKEND_URL` to the real https address, `UPLOADS_DIR` to a folder on the persistent disk, and `DATABASE_URL` to the database connection string.
3. Build command: `npm run build`
   Start command: `npm start`
4. Open the site, then **register with the `ADMIN_EMAIL` address straight away**. That account becomes the owner/admin. Check that inbox for the verification email and click it.

`npm start` creates the database tables, loads the BGCSE content (hidden from students until a teacher approves it) and starts the server. It refuses to start, with a clear message in the log, if any required setting is missing or unsafe.

## Email (required)

Password resets and email verification depend on it, so the server will not start without it.

1. Make a Gmail account just for Study Dome and turn on 2-Step Verification.
2. Go to `myaccount.google.com/apppasswords`, create an App Password, and copy the 16 letters.
3. Set `EMAIL_USER` (the Gmail address), `EMAIL_PASS` (the 16 letters, **not** the normal password) and `EMAIL_FROM`.
4. After starting, the log should say `[mail] Email is set up`. To send a real test message from the host's shell: `cd backend && npm run test:email -- someone@example.com`.

## Check it worked

- `https://YOUR-ADDRESS/api/health` shows `{"ok":true}`.
- The owner can sign in at `/admin/login` and sees the Admin menu.
- "Forgot password" on a test account delivers an email.
- Upload a test past paper in Admin, redeploy, and confirm the file is still there.

## Please also

- Turn on the host's database backups.
- Never commit `study-dome.env.production` or paste it anywhere public.
- Payments (DPO) are not switched on yet. Leave the `DPO_*` settings empty until the owner has a merchant account.
