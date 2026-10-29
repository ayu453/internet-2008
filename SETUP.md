# INTERNET 2008 — Setup & launch guide

This package contains the React/Vite web app, retro desktop UI, Supabase client integration, SQL schema, and setup instructions.

## What works immediately

- Retro desktop UI, taskbar, window controls, room navigation, profile screen and settings.
- Local guest mode to explore the UI.
- Local-only room messages while in guest/demo mode (these are **not** visible to other users).
- Name-only entry using Supabase anonymous auth (no email/password confirmation).
- Public room message history + realtime INSERT updates for authenticated users after database setup.
- Presence channel for signed-in users.
- Friend request UI and database operations.
- Server-side random matching RPC scaffold and match chat message subscription.

## Important limitations before public launch

This is a complete starter project, not a deployed service. A working internet-wide service requires a Supabase project, environment variables, SQL migration, auth configuration, hosting, testing with multiple real accounts, and security/moderation review.

Friend-to-friend private messaging now uses `get_or_create_friend_conversation()` to verify accepted friendships and create/reuse a stable conversation, with private message history and Supabase Realtime updates. Random matching polls `get_random_match_status()` while waiting and loads prior messages after a match is found. For an existing database, run `supabase/migrations/002_friend_private_messages.sql` in the Supabase SQL Editor, then run the updated `supabase/schema.sql` only on a fresh installation. Test with two separate authenticated sessions; do not publicly launch until these flows and moderation are reviewed.

## Requirements

- Node.js 20+ recommended
- npm
- A Supabase project

## Run locally

1. Unzip this folder.
2. Open a terminal inside `internet-2008`.
3. Run:

   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

4. Open the local URL printed by Vite.

The app runs in local demo mode until `.env` is filled in.

## Connect Supabase

1. Create a project at https://supabase.com/
2. In Project Settings / API, copy the project URL and publishable (or anon) key.
3. Put them into `.env`:

   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

4. In Supabase SQL Editor, run all of `supabase/schema.sql`.
5. In Supabase Dashboard → Authentication → Sign In / Providers, enable **Anonymous Sign-Ins**. Email confirmation is not needed for this name-only flow.
6. Restart `npm run dev` after editing `.env`.
7. Open the app on two separate browsers/devices, enter a display name in each, and test public room messages.

Never put a service-role/secret key in `.env` with a `VITE_` prefix or in browser code.

## Build for hosting

```bash
npm run build
npm run preview
```

The production static output is in `dist/`. Host it on a static host such as Vercel, Netlify, or Cloudflare Pages. Configure the same two public environment variables in the host dashboard and set the production redirect URL in Supabase Auth.

## Suggested launch checklist

- [ ] Test anonymous sessions, reconnect behavior, and name persistence
- [ ] Verify RLS using two different accounts
- [ ] Verify a third account cannot read private conversations or match messages
- [ ] Complete friend-to-friend private messaging UI and conversation creation RPC
- [x] Add match status polling so queued users notice a match without manual retry (requires updated schema)
- [x] Add a server-side conversation creation RPC and friend-to-friend private messaging UI/history/realtime
- [ ] Add visible block/report workflows and moderation dashboard
- [ ] Add message rate limiting and spam/abuse controls
- [ ] Add privacy policy, retention/deletion rules and account deletion
- [ ] Test reconnect, mobile layout, accessibility and keyboard behavior
- [ ] Configure monitoring, backups and project limits before public launch

## Architecture

- Frontend: React + Vite
- Auth/database: Supabase Auth + PostgreSQL
- Live public room messages: Supabase Realtime Postgres Changes
- Presence: Supabase Realtime Presence
- Friend DMs: `get_or_create_friend_conversation()` RPC + `private_messages` Realtime
- Random match: `find_random_match()` / `get_random_match_status()` / `leave_random_match()` RPC
- RLS: row-level access policies defined in `supabase/schema.sql`

## Troubleshooting

- `Supabase is not configured`: `.env` missing or values unchanged; restart Vite.
- Name-only sign-in fails: enable Anonymous Sign-Ins in Supabase Authentication settings. Anonymous sessions are browser/device-specific; a name alone is not a secure account recovery method.
- Messages don't arrive live: ensure `messages` and `random_match_messages` are included in `supabase_realtime`, and inspect RLS / Realtime settings.
- Random match RPC missing: execute the schema or relevant migration in the SQL editor.
- Friend DM RPC missing: run `supabase/migrations/002_friend_private_messages.sql` in the SQL editor.
- Friend request fails: use the exact profile UUID, and test with a second account.
