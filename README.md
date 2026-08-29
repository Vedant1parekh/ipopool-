# IPO PooL

A PWA for tracking Indian IPOs (Mainboard + SME) and coordinating isolated "pools" of PAN-card applications with family/friends.

Apply for IPOs as a group, with each person using their own funds — no money changes hands between members. More independent applications means better odds that someone in the group gets allotted.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth, Row Level Security).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Apply the schema**: open the SQL editor in your Supabase project and run `supabase/migrations/0001_init.sql`, then `0002_add_email_to_profiles.sql`.
3. **Copy environment variables**: `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page; only used server-side by the IPO sync job, never exposed to the client.
   - `IPO_DATA_API_KEY` — an [IPO Guru](https://www.ipoguru.in/ipo-gmp-details-developer-api) API key (request one by emailing `ipoguru.in@gmail.com`; free tier is 15 req/min, 300/day).
   - `CRON_SECRET` — any random string; also set it as an env var on Vercel so the cron route can authenticate scheduled requests.
   - `SIGNUP_REFERRAL_CODE` — the invite code required to sign up (server-side only, never exposed to the client).
4. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Project layout

- `src/app/dashboard` — IPO listing (Mainboard/SME tabs)
- `src/app/profile/pan` — add/manage PAN cards
- `src/app/pools` — create/join pools (requires ≥1 PAN card), pool detail + application log
- `src/app/profit-loss` — the logged-in user's own profit/loss ledger (isolated via RLS)
- `src/app/api/cron/sync-ipos` — scheduled job that syncs the `ipos` table from IPO Guru's API
- `src/proxy.ts` — Next 16's replacement for `middleware.ts`; does an optimistic auth redirect (every Server Action/page still re-verifies the session)
- `supabase/migrations/` — schema + Row Level Security policies, applied in order

## Notes

- **PWA**: manifest via `src/app/manifest.ts`, a hand-rolled service worker at `public/sw.js` (Turbopack, the default bundler in Next 16, doesn't support the webpack-plugin approach `next-pwa` relies on). If you need richer offline caching later, look at [Serwist](https://serwist.pages.dev/) instead of `next-pwa`.
- **Node version**: `@supabase/supabase-js` now asks for Node ≥22; this was scaffolded on Node 20, which still works today but you'll want to upgrade Node before it becomes a hard requirement.
- **v2 backlog**: clubbing-percentage profit splits and cross-user settlement tracking (the richer logic from the original Excel's "Profit details" sheet) — see the plan doc for details.
