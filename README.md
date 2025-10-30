# Tennis Tracker — PWA Starter (React + TS + Vite)

Offline-first point-by-point tennis tracker with IndexedDB cache, outbox sync, and Supabase wiring + real-time.

## Quick start
```bash
npm i
npm run dev
```

## Env (optional, for cloud sync)
Create `.env` in the project root:
```
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```
If not provided, the app runs in **local-only demo mode**.

## Supabase (multi-user, real-time)
- Run `supabase/schema.sql` in the Supabase SQL editor.
- Add yourself to `workspace_members` as `owner`.
- Set `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The app will queue writes (outbox), push via `runSync()`, fetch existing points, and subscribe to live updates.

## Where things live
- `src/lib/types.ts` — data model
- `src/lib/matchEngine.ts` — live score + basic stats
- `src/store/useMatchStore.ts` — local state & offline queue
- `src/lib/api.ts`, `src/lib/realtime.ts`, `src/lib/sync.ts` — server sync & realtime
- `src/components/*` — UI components
- `public/sw.js`, `public/manifest.webmanifest` — PWA bits
