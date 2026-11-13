# Temple Clarity API

A small Node.js server. **Postgres** stores activities, favorites/votes and the rest of the data in your `schema.sql`. **Supabase Auth** handles sign-up, login, passwords and sessions; this server only asks Supabase "who is this token?".

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
2. **Database:** use Supabase's Postgres or your own (for example managed Postgres on Gcore). Start from an **empty** database, then:
   ```sh
   cd backend
   cp .env.example .env        # fill in the values
   npm install
   export $(grep -v '^#' .env | xargs)
   npm run db:setup            # schema.sql, then schema_additions.sql, then seed.sql
   npm start
   ```
3. Check it: `curl localhost:3000/api/health` → `{"ok":true}`.

`schema.sql` is your file, unchanged, and can only be loaded once into a database. `seed.sql` is safe to run again: it updates activity text but leaves relevance scores and the `published` flag alone.

### Database files

- `schema.sql`: your schema, exactly as you wrote it.
- `schema_additions.sql`: two extra tables and a safety setting. `supabase_users` links a Supabase user (uuid) to a row in `users` (integer id), and `error_logs` stores the front end's error log. It also turns on row level security for every table, which blocks Supabase's public REST API from reading them (this server's database role bypasses it). Nothing in your tables is changed.
- `seed.sql`: the 16 genres, 8 emotions and 16 starting activities, with the same ids the front end already uses for its shareable links.

### How your tables are used

| Table | Used for |
| --- | --- |
| `users`, `user_profiles` | A row in each is created the first time someone signs in. `users.password_hash` is set to `'!supabase'` because Supabase owns the real password. `terms_accepted` / `terms_version` are set by `POST /api/terms-acceptance`. `last_seen_at` is updated by `GET /api/session`. |
| `activities`, `genres`, `activity_genres`, `emotions`, `activity_emotions` | Activity list. Only `published` activities are returned. The `relevance_score` for the chosen emotion orders the results (highest first). |
| `favorites`, `upvotes`, `downvotes` | Favorites and votes. A person has at most one vote per activity, so choosing a vote removes the other. |
| `user_abilities`, `site_events` | Only touched on account deletion, so nothing is left behind. |
| `more_specific_activities`, `abilities`, `activity_abilities`, `specific_activity_abilities`, `genre_abilities`, `event_types` | Not used yet. |

Time choices on the front end map to your `min_time` / `max_time`: 0-15 min, 15-45 min and 45+ min. An activity matches a choice when its range overlaps it.

### Things worth a second look in schema.sql

1. **A foreign key looks backwards.** `ALTER TABLE users ADD FOREIGN KEY (id) REFERENCES user_profiles (user_id)` makes every user depend on a profile, not the other way around. It is probably a flipped `Ref` in the DBML (it should likely be `user_profiles.user_id` pointing at `users.id`). The API works with it as written, creating the profile before the user and deleting the user before the profile, but fixing it would be simpler and safer.
2. **No uniqueness on favorites, upvotes or downvotes.** Nothing in the database stops the same person favoriting the same activity twice. The API prevents it (one request at a time per person, and it checks first), but a unique constraint on `(user_id, activity_id)` in each table would make it certain.
3. **`users.email` is not unique.** Supabase already enforces unique emails, so this is fine for now.
4. **`user_profiles.timezone` is a `timestamp`.** A timezone is usually a name like `America/Los_Angeles` (text). The API doesn't use it.
5. **`terms_version` keeps only the latest version** each person accepted, with no history of earlier ones.
6. **The seed's emotion scores are placeholders.** The first emotion listed for each activity scores 100, then 90, 80 and so on. Replace them with real scores.
7. **No indexes on the foreign key columns** (for example `favorites.user_id`). Not a problem at this size.

## Endpoints

| Method | Path | Login | What it does |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Liveness check. |
| GET | `/api/activities?bucket=short&emotion=Calm` | no | Matching published activities, best first. Both filters are optional. `bucket` is `short`, `medium` or `long`. |
| GET | `/api/activities/:id` | no | One activity (for shareable links). |
| GET | `/api/session` | optional | `{ "user": { id, email } }` or `{ "user": null }`. The first valid sign-in creates the person's rows. |
| GET / PUT | `/api/profile` | yes | `{ backgroundArt, musicOn, country }`. PUT changes only the fields you send. |
| GET | `/api/reactions` | yes | `{ "reactions": { "<activityId>": { fav, vote } } }`. |
| PUT | `/api/reactions/:activityId` | yes | Body `{ fav?: boolean, vote?: "up" \| "down" \| null }`. Only the fields you send change. |
| POST | `/api/terms-acceptance` | yes | Body `{ version: "2026-11-11" }`. Saves it to `users.terms_accepted` and `terms_version`. |
| DELETE | `/api/account` | yes | Body `{ password }`. Checks the password with Supabase, deletes the person's rows from every table, then deletes the Supabase user. |
| POST | `/api/log` | no | Receives the front end's error log (array of entries). Capped at 20 entries and 20 KB per request, rate limited. |

Errors come back as `{ "error": "message" }` with a normal status code (400, 401, 403, 404, 413, 429, 502).

## How it maps to the front end

| Front-end placeholder | Backend |
| --- | --- |
| `getRankedActivities()` | `GET /api/activities`. Ranking comes from `activity_emotions.relevance_score` and `rankActivities()` in `src/server.js`. Activities now carry `minMinutes`, `maxMinutes` and `minutes` instead of a `bucket`. |
| `authRequest()`, `sessionRequest()`, `logoutRequest()` | Supabase JS (`signUp`, `signInWithPassword`, `getSession`, `signOut`). The front end sends the access token to this API. |
| `deleteAccountRequest(password)` | `DELETE /api/account` |
| `termsAccepted` / `termsVersion` at sign-up | pass as Supabase user metadata, then `POST /api/terms-acceptance` once the user has a session |
| Favorites and votes (`localStorage`) | `GET` / `PUT /api/reactions` |
| Music on/off (`localStorage`) | `GET` / `PUT /api/profile` (`musicOn`) |
| `ERROR_LOG_ENDPOINT` | set to `https://<your-api>/api/log` |

The front end is **not wired to this API yet**; it still uses its placeholders.

## Security notes

- The `service_role` key can do anything in your Supabase project. Keep it only in the server's environment, never in the front end or Git. `.env` is git-ignored.
- Every SQL value is a bound parameter. Request bodies are capped, and API responses are never cached.
- CORS only allows the origins in `ALLOWED_ORIGINS`.
- Rate limits are in memory, so they reset on restart and aren't shared between servers. Run one instance, or move them to Redis if you scale out. Set `TRUST_PROXY=1` behind a proxy so limits use the real client IP.
- Tokens are checked with Supabase and cached for 30 seconds. A logged-out or deleted user can keep working for up to 30 seconds.
- Row level security is turned on for every table with no policies (in `schema_additions.sql`), which blocks Supabase's public REST API. This server connects as a database role that bypasses it.
- Error-log entries are scrubbed for emails again on the server. They contain no Void text.
- Run it over HTTPS (a reverse proxy or the CDN) in production.

## Hosting on Gcore

Run it on a Virtual Instance next to managed Postgres, behind Nginx or Caddy for HTTPS, kept alive with `systemd` or `pm2`. Set `SERVE_STATIC=1` to have it serve `index.html`, `og-image.png`, `robots.txt` and `sitemap.xml` from the repo root too, so one server hosts the whole site. Set `DATABASE_SSL=1` if the database requires SSL.

## Tests

```sh
npm test                    # API tests with an in-memory database and a fake Supabase (no network)
DATABASE_URL=postgresql://... npm run test:sql   # loads your schema, the additions and the seed, then runs every query, into an EMPTY scratch Postgres
```

## Not included yet

Sign-up email confirmation emails, password reset and email change all live in Supabase and need no code here. Endpoints for `site_events` (the recommender's input), the specific-activity and ability tables, and admin tools for adding activities or reading the error log aren't built; use SQL for now.
