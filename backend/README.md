# Temple Clarity API

A small Node.js server. **Postgres** stores activities, favorites/votes, terms acceptances and the front end's error log. **Supabase Auth** handles sign-up, login, passwords and sessions; this server only asks Supabase "who is this token?".

No framework: just Node's built-in `http` plus the `pg` driver (Node 20 or newer).

```
browser ──(Supabase JS: sign up / log in)──▶ Supabase Auth
   │                                             ▲
   └──(Authorization: Bearer <token>)──▶ this API ─┘  verifies the token, deletes users
                                           │
                                           ▼
                                        Postgres
```

## Setup

1. **Supabase:** create a project. Under Authentication, decide whether new users must confirm their email. Under Project Settings → API, copy the project URL, the `anon` key and the `service_role` key.
2. **Database:** use Supabase's Postgres or your own (for example managed Postgres on Gcore). Then:
   ```sh
   cd backend
   cp .env.example .env        # fill in the values
   npm install
   export $(grep -v '^#' .env | xargs)
   npm run db:setup            # creates the tables and loads the 16 starting activities
   npm start
   ```
3. Check it: `curl localhost:3000/api/health` → `{"ok":true}`.

`schema.sql` and `seed.sql` are safe to run again. Re-running the seed updates activity text but leaves `rank` and `active` alone.

## Endpoints

| Method | Path | Login | What it does |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Liveness check. |
| GET | `/api/activities?bucket=short&emotion=Calm` | no | Matching activities, best first. Both filters are optional. |
| GET | `/api/activities/:id` | no | One activity (for shareable links). |
| GET | `/api/session` | optional | `{ "user": { id, email } }` or `{ "user": null }`. |
| GET | `/api/reactions` | yes | `{ "reactions": { "<activityId>": { fav, vote } } }`. |
| PUT | `/api/reactions/:activityId` | yes | Body `{ fav?: boolean, vote?: "up" \| "down" \| null }`. Only the fields you send change. A row with neither set is deleted. |
| POST | `/api/terms-acceptance` | yes | Body `{ version: "2026-11-11" }`. Records which terms version the user agreed to. |
| DELETE | `/api/account` | yes | Body `{ password }`. Checks the password with Supabase, deletes the user's rows, then deletes the Supabase user. |
| POST | `/api/log` | no | Receives the front end's error log (array of entries). Capped at 20 entries and 20 KB per request, rate limited. |

Errors come back as `{ "error": "message" }` with a normal status code (400, 401, 403, 404, 413, 429, 502).

## How it maps to the front end

| Front-end placeholder | Backend |
| --- | --- |
| `getRankedActivities()` | `GET /api/activities` (ranking lives in `rankActivities()` in `src/server.js` and the `rank` column) |
| `authRequest()`, `sessionRequest()`, `logoutRequest()` | Supabase JS (`signUp`, `signInWithPassword`, `getSession`, `signOut`). The front end sends the access token to this API. |
| `deleteAccountRequest(password)` | `DELETE /api/account` |
| `termsAccepted` / `termsVersion` at sign-up | pass as Supabase user metadata, then `POST /api/terms-acceptance` once the user has a session |
| Favorites and votes (`localStorage`) | `GET` / `PUT /api/reactions` |
| `ERROR_LOG_ENDPOINT` | set to `https://<your-api>/api/log` |

The front end is **not wired to this API yet**; it still uses its placeholders.

## Security notes

- The `service_role` key can do anything in your Supabase project. Keep it only in the server's environment, never in the front end or Git. `.env` is git-ignored.
- Every SQL value is a bound parameter. Request bodies are capped, and API responses are never cached.
- CORS only allows the origins in `ALLOWED_ORIGINS`.
- Rate limits are in memory, so they reset on restart and aren't shared between servers. Run one instance, or move them to Redis if you scale out. Set `TRUST_PROXY=1` behind a proxy so limits use the real client IP.
- Tokens are checked with Supabase and cached for 30 seconds. A logged-out or deleted user can keep working for up to 30 seconds.
- The tables have row level security turned on with no policies, which blocks Supabase's public REST API. This server connects as a database role that bypasses it.
- Error-log entries are scrubbed for emails again on the server. They contain no Void text.
- Run it over HTTPS (a reverse proxy or the CDN) in production.

## Hosting on Gcore

Run it on a Virtual Instance next to managed Postgres, behind Nginx or Caddy for HTTPS, kept alive with `systemd` or `pm2`. Set `SERVE_STATIC=1` to have it serve `index.html`, `og-image.png`, `robots.txt` and `sitemap.xml` from the repo root too, so one server hosts the whole site. Set `DATABASE_SSL=1` if the database requires SSL.

## Tests

```sh
npm test                    # API tests with an in-memory database and a fake Supabase (no network)
DATABASE_URL=postgresql://... npm run test:sql   # runs the schema, seed and every query against a scratch Postgres
```

## Not included yet

Sign-up email confirmation emails, password reset and email change all live in Supabase and need no code here. Pagination isn't needed for 16 activities. Admin tools for adding activities or viewing the error log aren't built; use SQL for now.
