# Changelog

All notable changes to Temple Clarity. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are YYYY-MM-DD.

## [Unreleased]

### Added
- **Backend (`backend/`):** a small Node.js API using Postgres for data and Supabase for sign-in. Includes the database schema, the 16 starting activities, endpoints for activities, session, favorites/votes, terms acceptance, account deletion and the error log, plus tests. The front end is not wired to it yet. See `backend/README.md`.

Waiting on the backend: real sign-up, login, session, account deletion and error-log endpoints, plus the recommender and activity database. The front end already calls placeholder functions for each of them (`authRequest`, `sessionRequest`, `logoutRequest`, `deleteAccountRequest`, `getRankedActivities`, `ERROR_LOG_ENDPOINT`).

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
