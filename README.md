# INTERNET 2008

A nostalgic, Windows-era inspired web desktop and messenger. React + Vite frontend with Supabase Auth, PostgreSQL, Realtime, friend DMs, random matching, user report/block actions, and a daily conversation prompt.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Read [SETUP.md](./SETUP.md) before connecting a backend or launching publicly.

## Security note

Never expose Supabase service-role keys in client code. Private friend messaging, random-chat report/block actions, and the Daily Signal conversation starter are implemented on the feature branch but still require database migration and multi-account verification in [SETUP.md](./SETUP.md). A moderator review dashboard and abuse-response process are still needed before public launch. Random matchmaking now refreshes queue leases and expires abandoned queue entries when migration 008 is applied.
