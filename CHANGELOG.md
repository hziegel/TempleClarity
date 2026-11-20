# Changelog

All notable changes to Temple Clarity. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are YYYY-MM-DD.

## [Unreleased]

### Added (CMS)
- **Private Django admin (`cms/`)** for adding and editing activities from your own computer. It reads and writes the same Supabase database as the site and never creates or changes your tables (the models are `managed = False`). Add an activity with its description, time range in minutes, needs (group only, requires supplies), genre checkboxes and per-emotion weights; publish or unpublish one or many at once. Emotion names are saved in lowercase. Django's own login and session tables live in a local SQLite file, not in your Supabase `public` schema. Includes `fix_sequences` for the starter data's id counters and tests that check every model column against `backend/schema.sql`. Not part of the Docker image. Not yet run against a real Django install; see `cms/README.md`.

### Removed (screen-only)
- **The `screen_only` activity field is gone everywhere.** The column was dropped from the database, so the API no longer selects it and no longer returns `screenOnly`. It's also removed from `schema.sql`, the seed data, the add-activities template, the tests and the CMS model.

### Changed (landing page)
- **Time cards and the "Try this" result match the emotion cards.** The three "How much time do you have?" cards and the suggested-activity box are now solid `#cefbf4` rounded squares with `#0e1610` text. The time buttons also have a slight top-to-bottom gradient, a teal border and a soft shadow so they read as buttons. On hover they brighten instead of turning dark. Search results and profile lists are unchanged.
- **New flame logo.** The logo at the top of the page is now an SVG flame (a gradient from `#0e1610` at the center through `#9ecbcb` to `#cefbf4` at the edges, with a star cut out), replacing the PNG. The browser-tab icon and link-preview image are unchanged.
- **Emotion cards use hand-drawn artwork.** All eight cards (Happy, Sad, Mad, Scared, Bored, Tired, Nervous, Calm) are now SVG illustrations embedded in the page, each with its name in `#0e1610` on top. The cards are a little narrower than before (about 87px wide on desktop, 82px on phones).
- **The emotion cards are now the home page.** The separate welcome page with its three cards is gone. The home page opens with "Welcome to Temple Clarity" and, on separate lines, "A quiet place to find relaxing activities" (styled as a subheading under the title: lighter weight, title color, tucked close beneath it) and "Choose the card which best describes how you feel:" above the eight emotion cards, with the same slow fade-in. The Void and What's this? are reached from the menu. Old `#emotion-cards` links still work and open the home page, and the "Emotion Cards" menu entry was removed since Home is the same page.

### Added
- **Backend (`backend/`):** a small Node.js API using Postgres for data and Supabase for sign-in. Uses your `schema.sql` as-is, plus `schema_additions.sql` (Supabase link and error log tables), seed data for the 16 starting activities, endpoints for activities, session, profile, favorites/votes, terms acceptance, account deletion and the error log, and tests. See `backend/README.md`.

- **Front end connected to the backend:** Supabase sign-up, log-in, log-out, session restore, email confirmation and password reset (with a new-password form); favorites and votes saved to the account; activities and their ranking loaded from the API (with the built-in list as a fallback); account deletion; accepted-terms recording; music setting sync; error log sent to `/api/log`. Fill in `TC_CONFIG` (`apiBase`, `supabaseUrl`, `supabaseAnonKey`) to switch it on; left empty, the page runs in local mode as before.

### Added (email list)
- **Email list checkbox at sign-up:** an optional, unchecked-by-default "Email me occasional updates" box on the create-account form, available before the terms are read. The choice is saved to a new `email_list` table (`schema_additions.sql`) with the date of consent, and a matching checkbox on the logged-in page lets people unsubscribe. New `GET`/`PUT /api/email-list` endpoints; the row is removed when an account is deleted. If email confirmation is on, the choice is kept until the first log-in.

- **Email list form on "What's this?":** anyone can join without an account. Emails go to a new `email_subscribers` table through `POST /api/subscribe` (address cleaned to lower case, repeats are harmless and get the same answer, 5 tries per hour per visitor, hidden spam-trap field). Nothing is emailed yet, so there is no confirmation email.

- **About page wording:** the privacy sentence no longer says no personal information is stored; it now says only an email address, favorites and votes (for accounts) and the email address (for the email list) are kept.

- **Follow the developer:** a new section on the About page with a link to the Simply Joyful Designs YouTube channel (opens in a new tab).

- **Search filter "Show":** a dropdown on the search screen (All, Favorites, Upvotes) that narrows results to the person's own favorites or upvoted activities. It combines with the name, genre and time filters and is cleared by "Clear filters".

### Added (Docker)
- **Docker setup:** `Dockerfile` (Node 22, runs as a non-root user, health check on `/api/health`, no secrets in the image), `docker-compose.yml` (reads `backend/.env`) and `docker-compose.localdb.yml` (adds a local Postgres 16 loaded with the schema, the lower-case emotions and the seed). See `backend/README.md`. Not yet built or run with a live Docker engine; the compose files and the image's file layout were checked.

### Fixed (backend start-up)
- **The backend now reads `backend/.env` itself.** Before, `npm start` failed with "Missing required environment variable DATABASE_URL" unless the variables were exported by hand (and the README's `export` command only worked on Mac and Linux). A small built-in reader (`src/env.js`) loads the file on any system; variables already set in the real environment win, so Docker and hosts keep working. `db:setup` reads the same file, and the missing-variable error now says where to put it.

### Changed (settings)
- **Connection settings no longer live in `index.html`.** The backend serves `/config.js` built from its `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, new `PUBLIC_API_BASE`), and the page reads `window.TC_CONFIG` from it; a static host can use a `config.js` copied from `config.example.js`. The page strips a trailing `/rest/v1` from the Supabase address, which fixes a log-in problem when the REST address is pasted in. With no settings the page stays in local mode. The committed `index.html` has empty settings again.

### Changed (built-in activities)
- **The page's built-in activity list now matches `seed.sql`** (your 16 real activities, genres and scores), used when the API isn't connected or can't be reached. Times are now ranges, so cards and search results show "1\u201330 minutes" instead of "About 30 minutes" (a fixed time still reads "About 5 minutes"). Time choices and the search time filters use the same overlap rule as the server, and the fallback ranks by the scores like the API does (without the shuffle).

### Fixed
- **Emotion names are matched ignoring capitalization:** the database keeps emotion names in lower case (`happy`, `calm`…) while the site sends `Calm`; the activities query and the page's built-in fallback now compare without regard to case, so the relevance scores take effect. `test/sql.sh` adds the lower-case emotions itself because `seed.sql` leaves that table to be filled by hand, and its time-window checks now compare against the data instead of fixed counts.

### Added (music)
- **Default background music:** a quiet ambient loop (`ambient1-hum-pan`, re-encoded to 64 kbps and embedded in the page) fades in on the first tap, click or key press, because browsers block audio before that. The existing sound button turns it and the other sounds on or off, and the choice is remembered. It pauses while the tab is hidden. This makes the page about 2 MB.

### Added (recommender)
- **Recommender (`backend/src/recommender.js`):** ranks activities for the chosen feeling and time by `activity_emotions.relevance_score` (a score of 0 hides an activity for that feeling; falls back to the whole time window if nothing is scored). No machine learning. Includes tests and a README section on setting scores.
- **Gumbel-Max score perturbation:** the recommender orders activities with the Gumbel-Max trick, so the order changes from one request to the next while higher scores still tend to come first (chance of first place is proportional to the score). `RECOMMENDER_TEMPERATURE` controls how much (default 1; 0 turns shuffling off). "Try another" puts the activity just shown last when it starts a new round.

 is easier to read:** larger, brighter text on the activity card, emotion cards and home cards, with a darker card background. Home card captions wrap to two lines instead of touching the edges.
- The error log now sends with `fetch` (keepalive, no cookies) instead of `sendBeacon` so it works across sites.

## 2026-11-13

### Changed
- **Logo:** new glowing blue-green logo in the page header (placed lower, full opacity, still scrolls with the page). The browser tab icon uses the flat blue-green version.

## 2026-11-12

### Added
- **Logo:** the Temple Clarity logo at the top center of every page (scrolls with the page, links home), and as the browser tab icon in place of the smiley.
- **Delete account:** logged-in users can delete their account from the Log in page, after typing their password. Clears saved favorites and votes on the device. Needs a backend to work.
- **Error log:** `logError`, `getErrorLog`, `clearErrorLog`, `flushErrorLog`. Catches uncaught errors and logs known failure points. Emails and tokens are scrubbed, repeats are merged, and the newest 50 entries are kept for the tab session. Nothing is sent anywhere until `ERROR_LOG_ENDPOINT` is set.
- **Logged-out toast:** tapping the heart, thumbs up or thumbs down while logged out shows "Your response will not be saved unless you log in or create an account" with a Log in link.
- **SEO:** meta description, canonical URL (`https://templeclarity.com/`), Open Graph and Twitter tags with a 1200x630 preview image, JSON-LD, favicon, `robots.txt`, `sitemap.xml`, no-JavaScript fallback text, and `SEO.md` notes.
- **Card captions:** "Emotion Cards", "The Void" and "What's this?" now appear inside the three home cards.
- **Accessibility:** page title changes with each room, focus moves to the room heading on navigation, screen readers hear toasts and "Your thoughts have gone into the void", sound button reports on/off, and form fields point to their error messages.

### Changed
- **Try another:** now steps through a queue in a fixed order and never repeats until every activity in the pool has been shown. `getRankedActivities(emotion, bucket)` replaces `getRecommendation` as the place to plug in the recommender.
- **Mobile layout:** more room under the fixed icons, 44px tap targets for the back arrow, Show/Hide and account links, three emotion cards per row on phones, background image no longer uses `background-attachment: fixed` (iOS), `100dvh` heights, and a theme color.
- **Terms of Service:** account deletion clause now mentions the in-app option.
- **Sound:** the audio engine now wakes itself if the browser suspends or interrupts it.

### Removed
- Unused Google Fonts request.

## 2026-11-11

### Added
- First version: one-page, hash-routed app with the temple background, welcome text and three icon cards.
- **Emotion Cards:** "How do you feel?" (Happy, Sad, Mad, Scared, Bored, Tired, Nervous, Calm), then "How much time do you have?" (0-15 minutes, 15-45 minutes, 45 minutes+), then an activity suggestion with Try another, Copy link, and favorite / upvote / downvote.
- **Shareable activity links:** each activity has its own URL (`#activity-N`).
- **The Void:** type thoughts, press Send, and they fade away letter by letter. Never saved.
- **Search Activities:** search by name, genre filter (16 genres), and min/max time filters.
- **My Profile:** collapsible Favorites, Upvotes and Downvotes, with delete and undo on each item.
- **Log in / Log out** page with sign-up (front end only for now).
- **Terms of Service:** full page, and a required scroll-to-the-end agreement checkbox at sign-up. The sign-up request includes `termsAccepted` and `termsVersion`.
- **About page:** project description and "About the Developer" section.
- **Menu:** dropdown with Home, Emotion Cards, The Void, Search Activities, My Profile, What's this?, and Log in / Log out.
- **Sound:** gentle generated sounds for sending to the Void and for card clicks, with a global mute on the music note.
- **Front page animation:** text and cards fade in one after another; clicking anywhere shows everything at once.
- Soft yellow glow along the bottom of the page.
