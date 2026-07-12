# Proof: live build log

A public, read-only proof-of-work page (habits with streaks + custom to-do
lists like Fitness/Work/Study, with daily logs and optional due-date goals)
at your own URL, with a passphrase-gated admin page to update it from any
device. Real backend: Next.js + Supabase (Postgres), deployed on Vercel.

## 1. Database - Supabase (free tier)

1. Go to supabase.com, create a free project.
2. In the project, open **SQL Editor -> New query**, paste the contents of
   `schema.sql`, and click **Run**.
3. Go to **Project Settings -> API** and copy:
   - **Project URL** -> `SUPABASE_URL`
   - **service_role key** (NOT the anon/public key) -> `SUPABASE_SERVICE_ROLE_KEY`

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSCODE=pick-your-own-passphrase
SESSION_SECRET=any-long-random-string
```

`ADMIN_PASSCODE` is what you type at `/admin` to unlock editing.
`SESSION_SECRET` just needs to be long and random - used to sign your login
session. Never share the service role key or session secret publicly.

## 3. Run it locally (optional, to check it before deploying)

```
npm install
npm run dev
```

Visit `http://localhost:3000` (public page) and `http://localhost:3000/admin`
(enter your passphrase to add lists, habits, and tasks).

## 4. Deploy - Vercel (free tier)

1. Push this folder to a new GitHub repo (or use `vercel` CLI directly from
   the folder - `npx vercel`).
2. Import the repo at vercel.com/new.
3. In the Vercel project's **Settings -> Environment Variables**, add the same
   four variables from `.env.local`.
4. Deploy. Your public page is live at the URL Vercel gives you - put that in
   your bio. Keep `/admin` to yourself.

## How it works

- **Habits**: recurring things you do daily, shown with a streak grid, like
  HabitKit.
- **Lists**: custom categories (Fitness, Work, Study, or anything else) you
  add from `/admin`. Each list has its own section on the public page.
- Inside a list, log an entry with no due date and it lands in that day's
  build log (a running history). Add a due date instead and it becomes a
  goal that shows "due in Nd" or "Nd overdue" until you check it off.

## Notes

- The public page (`/`) never touches your Supabase keys - all reads happen
  server-side.
- `/admin` is protected by the passphrase, not a full user-account system.
  Good enough for a personal single-owner log; don't reuse a passphrase from
  somewhere sensitive.
- To add your own domain later: Vercel project -> Settings -> Domains.
