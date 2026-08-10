# DANAPLAY — Agent Memory

## Stack
- Backend: Node.js + Express + better-sqlite3 (port 12000). Tests: `cd backend && PORT=12000 node tests/e2e.js` (51/51 pass).
- Mobile: Expo SDK 54 (React Native 0.81.5, React 19.1.0), expo-router ~6.0.24. App router root = `mobile/app/` (NOT `mobile/src/app/` — that stale dir was removed; it hijacked the router root).
- Admin panel: REMOVED (user requested). Do not re-add.

## Running locally
- Backend: `cd backend && rm -f data/danaplay.db && node src/db/seed.js && PORT=12000 node src/server.js`
- Mobile (QR): `cd mobile && npx expo start --tunnel --port 8081`
- Demo user: phone=081234567890, password=password123, balance=1,250,000 points.
- Public work host: https://work-1-wjdyyqducsjxeigt.prod-runtime.all-hands.dev (maps to localhost:12000). app.json `extra.apiBaseUrl` points here so Expo Go on a phone can reach the backend.

## Ad feature (daily task)
- Tables: `ads`, `ad_views`. Service: `backend/src/services/adEngine.js`. Routes: `backend/src/routes/ads.js` (mounted `/api/ads`).
- Config (config/index.js + .env.example): AD_DAILY_LIMIT=50, AD_REWARD_PER_VIEW=1000, AD_MIN_WATCH_SECONDS=15, AD_COOLDOWN_SECONDS=30, AD_VIEW_TTL_SECONDS=120.
- Anti-fraud: server-side elapsed-time validation (skip rejected 422), cooldown after rewarded views, idempotent reward via view_token + reward_granted flag, unique active_days.
- Mobile: `src/AdViewer.tsx` (countdown modal, no skip), daily task card on `app/(tabs)/home.tsx`, API methods in `src/api.ts`.

## Gotchas
- `typedRoutes` experiment is DISABLED (causes false-positive type errors on dynamic routes in expo-router v6). Keep off.
- `width: '50%'` inline styles need `as DimensionValue` cast (RN 0.81 stricter ViewStyle).
- Install with `--legacy-peer-deps` (react-native 0.81 peer conflict). Pin `babel-preset-expo@~54.0.10`.
- Date parsing: use `parseDate()` from utils (handles both ISO-with-Z and SQLite `YYYY-MM-DD HH:MM:SS`).
- Throw `fail(status, msg, code)` (ApiError), NOT `new Error + err.status`.

## Git
- Remote: github.com/kdsmedia/DANAPLAY (token in remote URL). Branch: main.
