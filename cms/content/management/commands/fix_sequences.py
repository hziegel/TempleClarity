from django.core.management.base import BaseCommand
from django.db import connections

# Tables whose ids the CMS creates. If rows were inserted with explicit ids (as seed.sql does),
# Postgres's counter is still at 1 and the next insert fails with "duplicate key". This moves
# each counter past the highest id already in the table. It is safe to run any time.
TABLES = ["activities", "activity_emotions", "activity_genres", "emotions", "genres"]


class Command(BaseCommand):
    help = "Move each id counter past the highest existing id so new rows don't collide."

    def handle(self, *args, **options):
        with connections["content"].cursor() as cursor:
            for table in TABLES:
                cursor.execute("SELECT pg_get_serial_sequence(%s, 'id')", [table])
                sequence = cursor.fetchone()[0]
                if not sequence:
                    self.stdout.write(f"{table}: no id counter found, skipped")
                    continue
                cursor.execute(f'SELECT COALESCE(MAX(id), 0) FROM "{table}"')
                top = cursor.fetchone()[0]
                cursor.execute("SELECT setval(%s, %s, %s)", [sequence, max(top, 1), top > 0])
                self.stdout.write(f"{table}: next id will be {top + 1}")
