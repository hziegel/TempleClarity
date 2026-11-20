"""Run with: python -m unittest discover -s tests   (no Django needed for these)."""
import ast
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tcms.helpers import database_from_url, env_flag, load_dotenv  # noqa: E402


class DatabaseUrl(unittest.TestCase):
    def test_pooler_url(self):
        db = database_from_url(
            "postgresql://postgres.abcd:p%40ss%2Fw0rd@aws-0-us-west-1.pooler.supabase.com:5432/postgres", ssl=True
        )
        self.assertEqual(db["USER"], "postgres.abcd")
        self.assertEqual(db["PASSWORD"], "p@ss/w0rd")
        self.assertEqual(db["HOST"], "aws-0-us-west-1.pooler.supabase.com")
        self.assertEqual(db["PORT"], "5432")
        self.assertEqual(db["NAME"], "postgres")
        self.assertEqual(db["OPTIONS"], {"sslmode": "require"})
        self.assertTrue(db["DISABLE_SERVER_SIDE_CURSORS"])

    def test_no_ssl_unless_asked(self):
        self.assertEqual(database_from_url("postgres://u:p@h/db")["OPTIONS"], {})
        self.assertEqual(database_from_url("postgres://u:p@h/db?sslmode=verify-full")["OPTIONS"], {"sslmode": "verify-full"})

    def test_defaults(self):
        db = database_from_url("postgresql://u:p@h")
        self.assertEqual((db["NAME"], db["PORT"]), ("postgres", "5432"))

    def test_rejects_bad_urls(self):
        for bad in ("mysql://u:p@h/db", "postgresql:///db", "not a url"):
            with self.assertRaises(ValueError):
                database_from_url(bad)


class DotEnv(unittest.TestCase):
    def test_reads_and_does_not_override(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / ".env"
            path.write_text(
                "﻿# comment\nTC_A=1\nexport TC_B = 'two words'\nTC_C=\"x\" \nTC_D=val # note\nTC_E=keep\nbad line\n",
                encoding="utf-8",
            )
            os.environ["TC_E"] = "already"
            try:
                self.assertTrue(load_dotenv(path))
                self.assertEqual(os.environ["TC_A"], "1")
                self.assertEqual(os.environ["TC_B"], "two words")
                self.assertEqual(os.environ["TC_C"], "x")
                self.assertEqual(os.environ["TC_D"], "val")
                self.assertEqual(os.environ["TC_E"], "already")
            finally:
                for key in ("TC_A", "TC_B", "TC_C", "TC_D", "TC_E"):
                    os.environ.pop(key, None)

    def test_missing_file(self):
        self.assertFalse(load_dotenv(ROOT / "no-such.env"))

    def test_flag(self):
        os.environ["TC_F"] = "On"
        try:
            self.assertTrue(env_flag("TC_F"))
            os.environ["TC_F"] = "0"
            self.assertFalse(env_flag("TC_F", True))
        finally:
            os.environ.pop("TC_F", None)
        self.assertTrue(env_flag("TC_NOT_SET", True))


def schema_columns():
    """{table: {column, ...}} read from backend/schema.sql."""
    text = (ROOT.parent / "backend" / "schema.sql").read_text(encoding="utf-8")
    tables = {}
    for name, body in re.findall(r'CREATE TABLE "(\w+)" \((.*?)\n\);', text, re.S):
        tables[name] = set(re.findall(r'^\s*"(\w+)"\s', body, re.M))
    return tables


class ModelsMatchSchema(unittest.TestCase):
    """Django isn't needed: read models.py as text and compare it with schema.sql."""

    def test_every_model_column_exists(self):
        tables = schema_columns()
        tree = ast.parse((ROOT / "content" / "models.py").read_text(encoding="utf-8"))
        checked = 0
        for node in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
            meta = next((n for n in node.body if isinstance(n, ast.ClassDef) and n.name == "Meta"), None)
            table = None
            for stmt in (meta.body if meta else []):
                if isinstance(stmt, ast.Assign) and stmt.targets[0].id == "db_table":
                    table = stmt.value.value
            self.assertIsNotNone(table, f"{node.name} has no db_table")
            self.assertIn(table, tables, f"{node.name}: table {table} is not in schema.sql")
            for stmt in node.body:
                if not (isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Call)):
                    continue
                func = stmt.value.func
                if not (isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "models"):
                    continue
                column = stmt.targets[0].id
                for kw in stmt.value.keywords:
                    if kw.arg == "db_column":
                        column = kw.value.value
                self.assertIn(column, tables[table], f"{node.name}.{stmt.targets[0].id}: no column {table}.{column}")
                checked += 1
        self.assertGreater(checked, 20)

    def test_all_models_are_unmanaged(self):
        tree = ast.parse((ROOT / "content" / "models.py").read_text(encoding="utf-8"))
        for node in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
            meta = next(n for n in node.body if isinstance(n, ast.ClassDef) and n.name == "Meta")
            flags = {
                s.targets[0].id: s.value.value
                for s in meta.body
                if isinstance(s, ast.Assign) and isinstance(s.value, ast.Constant)
            }
            self.assertIs(flags.get("managed"), False, f"{node.name} must be managed = False")


if __name__ == "__main__":
    unittest.main()
