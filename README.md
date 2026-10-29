# INTERNET 2008

A nostalgic, Windows-era inspired web desktop and messenger starter. React + Vite frontend with Supabase Auth, PostgreSQL, Realtime and a database-backed random matching scaffold.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Read [SETUP.md](./SETUP.md) before connecting a backend or launching publicly.

## Security note

Never expose Supabase service-role keys in client code. Private friend messaging is implemented on the feature branch but requires the migration and two-account verification in [SETUP.md](./SETUP.md). Review all SQL policies, complete match-state UX, and add moderation before public launch.
