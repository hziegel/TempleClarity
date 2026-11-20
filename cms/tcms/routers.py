"""Sends the content app to the Supabase database and everything else to local SQLite.

Why two databases: Django's own tables (admin login, sessions, permissions) must not be created
in your Supabase `public` schema, because Supabase exposes `public` tables through its API.
They live in a small local file instead (cms/cms.sqlite3). Your real tables are only read and
written, never created or altered, because the content models are `managed = False`.
"""

CONTENT_APPS = {"content"}


class ContentRouter:
    def db_for_read(self, model, **hints):
        return "content" if model._meta.app_label in CONTENT_APPS else None

    def db_for_write(self, model, **hints):
        return "content" if model._meta.app_label in CONTENT_APPS else None

    def allow_relation(self, obj1, obj2, **hints):
        # Only relations inside the same database are allowed.
        return (obj1._meta.app_label in CONTENT_APPS) == (obj2._meta.app_label in CONTENT_APPS)

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label in CONTENT_APPS:
            return False  # Never create or change the Supabase tables from here.
        return db == "default"
