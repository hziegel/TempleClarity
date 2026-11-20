# Temple Clarity CMS

A private Django admin for adding and editing activities, run on **your own computer**. It reads and writes the same Supabase database as the site, so a published activity shows up on the site straight away.

It is not part of the website and is not in the Docker image. It never creates, alters or drops your tables: your `backend/schema.sql` stays the source of truth.

## One-time setup

You need Python 3.12 or newer (`python3 --version`).

```
cd cms
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Database address.** The CMS reads `DATABASE_URL` (and `DATABASE_SSL`) from `cms/.env`, or from `backend/.env` if there is no `cms/.env`. If the backend already runs on your computer, you don't need to do anything. It must be the **Session pooler** string, the same one the backend uses.

```
python manage.py migrate           # creates cms.sqlite3, a small local file for your admin login
python manage.py createsuperuser   # pick a username and a strong password
python manage.py fix_sequences     # once, so new rows don't collide with the starter data
```

`migrate` only touches the local `cms.sqlite3` file, never Supabase. Django's login and session tables are kept out of your Supabase `public` schema on purpose, because Supabase exposes that schema through its API.

## Every time

```
cd cms
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python manage.py runserver
```

Open <http://127.0.0.1:8000/> and log in. Stop it with `Ctrl+C`.

## Adding an activity

**Activities → Add activity**, then:

- **Title** must be unique. **Description** is the text on the card.
- **Published** is off by default: a draft isn't shown on the site until you tick it. On the activity list you can tick **Published** for several rows and press **Save**, or use the actions menu to publish or unpublish a selection.
- **Shortest / longest time** are in minutes (`0.5` = 30 seconds). The site's choices match any activity whose range overlaps them: short = 0–15, medium = 15–45, long = 45 and up. The card shows the longest time.
- **Needs**: group only, requires supplies.
- **Genres**: tick any that apply.
- **Emotions and weights**: pick an emotion and a number. Higher = suggested sooner for that feeling; `0` = never. Leave an emotion out if the activity doesn't fit it. A new activity opens with eight blank rows, one per emotion; an existing one shows only as many blank rows as it needs to reach eight. Blank rows are ignored.

Emotion names are saved in lowercase, to match the rest of your data. The site only has the eight emotion cards (happy, sad, mad, scared, bored, tired, nervous, calm), so a new emotion won't appear until the front end has a card for it.

## Deleting

Prefer **Unpublish**: it hides an activity and keeps people's favorites and votes. **Delete** removes the activity, its genre and emotion links, and every user's favorite and vote on it. In your usage statistics, the activity's events are kept but no longer point to it. Django shows you exactly what will go before you confirm.

## If something goes wrong

- **`duplicate key value violates unique constraint "..._pkey"`** when saving: run `python manage.py fix_sequences`.
- **`Network is unreachable`, or a timeout:** `DATABASE_URL` is the direct connection. Use the Session pooler string.
- **`password authentication failed`:** the password in `DATABASE_URL` is wrong or not percent-encoded (`@` is `%40`, `/` is `%2F`).
- **`DATABASE_URL is not set`:** there is no `cms/.env` and no `backend/.env` with it. Copy `cms/.env.example` to `cms/.env` and fill it in.
- **Forgot the admin password:** `python manage.py changepassword YOUR-USERNAME`.

## Keep it private

It listens only on `127.0.0.1`, which only your computer can reach. Don't put it on a public address, and don't run it with `runserver 0.0.0.0`. Your admin login lives in `cms/cms.sqlite3`, and the generated secret key in `cms/.secret_key`. Both are in `.gitignore` and stay on your machine.

## Tests

```
python -m unittest discover -s tests
```

These need no Django and no database. They check the settings helpers, and that every column the models use exists in `backend/schema.sql`.
