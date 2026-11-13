# Temple Clarity

A quiet, human-made web space to relax, vent and find offline activities. Click through the Emotion Cards to get an activity suggestion based on how you feel and how much time you have, or type into the Void, a chat window that goes nowhere and never saves your text.

By Heron of [Simply Joyful Designs](mailto:mail@simplyjoyfuldesigns.com).

## What's here

- `index.html` is the whole front end in one self-contained file (background image embedded). Open it in a browser to run it.
- `backend/` is the API (Node.js, Postgres, Supabase Auth). See `backend/README.md`.
- `CHANGELOG.md` lists what changed and when.
- `SEO.md` has notes on search and link previews.

## Status

The front end is complete. These parts are placeholders waiting for a backend:

- `getRecommendation()` is the swap point for the real recommender and activity database.
- `authRequest()`, `sessionRequest()` and `logoutRequest()` are the sign-up, login and session calls. Sign-up sends `termsAccepted` and `termsVersion`.
- Favorites and votes are stored in the browser (`localStorage`) for now.

Before launch, fill in the two `[YOUR STATE OR COUNTRY]` placeholders in the Terms of Service.
