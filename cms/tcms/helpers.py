"""Small helpers with no Django imports, so they can be tested without Django installed."""
import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

TRUE_WORDS = {"1", "true", "yes", "on"}


def env_flag(name, default=False):
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in TRUE_WORDS


def load_dotenv(path):
    """Read KEY=VALUE lines into os.environ without overriding anything already set.
    Returns True if the file was read."""
    try:
        text = Path(path).read_text(encoding="utf-8-sig")
    except OSError:
        return False
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, sep, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not sep or not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        os.environ.setdefault(key, value)
    return True


def database_from_url(url, ssl=False):
    """Turn postgresql://user:pass@host:5432/db into a Django DATABASES entry."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("DATABASE_URL must start with postgresql://")
    if not parsed.hostname:
        raise ValueError("DATABASE_URL has no host name")
    query = parse_qs(parsed.query)
    sslmode = (query.get("sslmode") or [None])[0]
    if not sslmode and ssl:
        sslmode = "require"
    options = {"sslmode": sslmode} if sslmode else {}
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")) or "postgres",
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname,
        "PORT": str(parsed.port or 5432),
        "OPTIONS": options,
        # Supabase poolers can break server-side cursors; plain cursors are fine at this size.
        "DISABLE_SERVER_SIDE_CURSORS": True,
        "CONN_MAX_AGE": 0,
    }
