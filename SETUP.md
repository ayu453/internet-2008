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
- Private friend conversation screen and message history/realtime flow after the private messaging migration is applied.
- Server-side random matching RPC scaffold and match chat message subscription.

## Important limitations before public launch

This is a complete starter project, not a deployed service. A working internet-wide service requires a Supabase project, environment variables, SQL migration, auth configuration, hosting, testing with multiple real accounts, and security/moderation review.

Private friend-to-friend messaging UI and its conversation creation RPC are included on the `feat/friend-private-messaging` branch. Existing Supabase projects must run `supabase/migrations/002_friend_private_messages.sql` after the base schema, then `supabase/migrations/003_serialize_random_matchmaking.sql` to serialize concurrent match/leave requests, and `supabase/migrations/004_atomic_friend_request_response.sql` to make accepting a friend request and creating the friendship one transaction. The client polls for a match while queued. Verify sending, history, realtime delivery, matching, and privacy with separate authenticated accounts. Do not publicly launch until these flows are completed and tested.

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
5. For an existing project that already has the schema, run `supabase/migrations/002_friend_private_messages.sql` after the base schema to enable private friend conversations.
6. Run `supabase/migrations/003_serialize_random_matchmaking.sql` to prevent overlapping match/leave RPCs from assigning a user to multiple active matches.
7. Run `supabase/migrations/004_atomic_friend_request_response.sql` so accepting a request and creating its friendship succeed or fail together.
8. In Supabase Dashboard → Authentication → Sign In / Providers, enable **Anonymous Sign-Ins**. Email confirmation is not needed for this name-only flow.
9. Restart `npm run dev` after editing `.env`.
10. Open the app on two separate browsers/devices, enter a display name in each, and test public room messages, random matching, and private messages between accepted friends.

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
- [ ] Verify friend-to-friend private messaging with two accounts and confirm a third account cannot read conversations
- [ ] Verify queued users automatically transition to matched state when a second user joins
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
- Random match: `find_random_match()` / `leave_random_match()` RPC
- RLS: row-level access policies defined in `supabase/schema.sql`

## Troubleshooting

- `Supabase is not configured`: `.env` missing or values unchanged; restart Vite.
- Name-only sign-in fails: enable Anonymous Sign-Ins in Supabase Authentication settings. Anonymous sessions are browser/device-specific; a name alone is not a secure account recovery method.
- Messages don't arrive live: ensure `messages` and `random_match_messages` are included in `supabase_realtime`, and inspect RLS / Realtime settings.
- Random match RPC missing: execute `supabase/schema.sql` in the SQL editor.
- Friend request fails: use the exact profile UUID, and test with a second account.
