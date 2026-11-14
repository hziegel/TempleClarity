# Changelog

All notable changes to Temple Clarity. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are YYYY-MM-DD.

## [Unreleased]

### Added
- **Backend (`backend/`):** a small Node.js API using Postgres for data and Supabase for sign-in. Uses your `schema.sql` as-is, plus `schema_additions.sql` (Supabase link and error log tables), seed data for the 16 starting activities, endpoints for activities, session, profile, favorites/votes, terms acceptance, account deletion and the error log, and tests. See `backend/README.md`.

- **Front end connected to the backend:** Supabase sign-up, log-in, log-out, session restore, email confirmation and password reset (with a new-password form); favorites and votes saved to the account; activities and their ranking loaded from the API (with the built-in list as a fallback); account deletion; accepted-terms recording; music setting sync; error log sent to `/api/log`. Fill in `TC_CONFIG` (`apiBase`, `supabaseUrl`, `supabaseAnonKey`) to switch it on; left empty, the page runs in local mode as before.

### Added (email list)
- **Email list checkbox at sign-up:** an optional, unchecked-by-default "Email me occasional updates" box on the create-account form, available before the terms are read. The choice is saved to a new `email_list` table (`schema_additions.sql`) with the date of consent, and a matching checkbox on the logged-in page lets people unsubscribe. New `GET`/`PUT /api/email-list` endpoints; the row is removed when an account is deleted. If email confirmation is on, the choice is kept until the first log-in.

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
