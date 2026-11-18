// Reads backend/.env (next to package.json) into process.env, so `npm start` works without
// exporting anything by hand, on any operating system and any Node 20+. Variables that are already
// set in the real environment win, which is how Docker and hosting services provide them.
import { readFileSync } from "node:fs";

export function parseEnv(text) {
  const out = {};
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(["']).*\1$/.test(v) && v.length >= 2) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");              // trailing comment on an unquoted value
    out[m[1]] = v;
  }
  return out;
}

export function loadDotEnv(file = new URL("../.env", import.meta.url), env = process.env) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return false; throw e; }
  for (const [k, v] of Object.entries(parseEnv(text))) if (env[k] === undefined) env[k] = v;
  return true;
}
