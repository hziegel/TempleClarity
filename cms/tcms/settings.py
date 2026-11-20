"""Settings for the Temple Clarity CMS: a Django admin for you only, run on your own computer."""
import os
import secrets
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .helpers import database_from_url, env_flag, load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# cms/.env wins; then fall back to the backend's .env so the password is only kept once.
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "backend" / ".env")


def _secret_key():
    value = os.environ.get("CMS_SECRET_KEY", "").strip()
    if value:
        return value
    path = BASE_DIR / ".secret_key"
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        pass
    value = secrets.token_urlsafe(50)
    try:
        path.write_text(value, encoding="utf-8")
    except OSError:
        pass  # Still works for this run; sessions just won't survive a restart.
    return value


SECRET_KEY = _secret_key()

# This is for your own computer only. Do not put this on a public address.
DEBUG = env_flag("CMS_DEBUG", True)
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "content",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "tcms.urls"
WSGI_APPLICATION = "tcms.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

_database_url = os.environ.get("DATABASE_URL", "").strip()
if not _database_url:
    raise ImproperlyConfigured(
        "DATABASE_URL is not set. Put it in cms/.env (see cms/.env.example), "
        "or keep it in backend/.env, which the CMS also reads."
    )

DATABASES = {
    # Django's own tables (your admin login, sessions): a small local file.
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "cms.sqlite3",
    },
    # Your real data in Supabase.
    "content": database_from_url(_database_url, ssl=env_flag("DATABASE_SSL", False)),
}
DATABASE_ROUTERS = ["tcms.routers.ContentRouter"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
# The Supabase columns are `timestamp` (no time zone) and hold UTC, so keep Django naive/UTC too.
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = False

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Local-only: keep the login cookie off other sites and out of plain sight.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
