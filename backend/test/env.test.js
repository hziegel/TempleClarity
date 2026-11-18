import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv, loadDotEnv } from "../src/env.js";

test("parses KEY=VALUE lines, comments, quotes, export, CRLF and a BOM", () => {
  const text = "﻿# comment\r\nDATABASE_URL=postgresql://u:p%40ss@host:5432/db?sslmode=require\r\n\r\nexport A=1\nB = two words  # note\nC=\"quoted # not a comment\"\nD='single'\nEMPTY=\nnot a line\n";
  assert.deepEqual(parseEnv(text), {
    DATABASE_URL: "postgresql://u:p%40ss@host:5432/db?sslmode=require",
    A: "1", B: "two words", C: "quoted # not a comment", D: "single", EMPTY: "",
  });
});

test("loadDotEnv fills missing variables only, and a missing file is fine", () => {
  const f = path.join(mkdtempSync(path.join(tmpdir(), "env-")), ".env");
  writeFileSync(f, "X=from-file\nY=from-file\n");
  const env = { Y: "already-set" };
  assert.equal(loadDotEnv(f, env), true);
  assert.deepEqual(env, { X: "from-file", Y: "already-set" });
  assert.equal(loadDotEnv(f + ".missing", {}), false);
});
