import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSupabaseUrl, browserConfigScript } from "../src/browser-config.js";
import { loadConfig } from "../src/config.js";

test("the Supabase address is cleaned up", () => {
  for (const u of ["https://abc.supabase.co", "https://abc.supabase.co/", "https://abc.supabase.co/rest/v1/", "https://abc.supabase.co/rest/v1", "https://abc.supabase.co/auth/v1/", "  https://abc.supabase.co  "])
    assert.equal(cleanSupabaseUrl(u), "https://abc.supabase.co", u);
  assert.equal(cleanSupabaseUrl(undefined), "");
});

test("script is valid JavaScript with only the public fields, even for odd characters", () => {
  const script = browserConfigScript({ supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: 'k"</script>', publicApiBase: "https://api.example.com/", supabaseServiceKey: "NOPE", databaseUrl: "NOPE" });
  const w = {}; new Function("window", script)(w);
  assert.deepEqual(w.TC_CONFIG, { apiBase: "https://api.example.com", supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: 'k"</script>' });
  assert.ok(!script.includes("NOPE"));
});

test("missing settings give empty strings, which keeps the page in local mode", () => {
  const w = {}; new Function("window", browserConfigScript({}))(w);
  assert.deepEqual(w.TC_CONFIG, { apiBase: "", supabaseUrl: "", supabaseAnonKey: "" });
});

test("loadConfig reads PUBLIC_API_BASE and cleans SUPABASE_URL", () => {
  const c = loadConfig({ DATABASE_URL: "x", SUPABASE_URL: "https://abc.supabase.co/rest/v1/", SUPABASE_ANON_KEY: "k", SUPABASE_SERVICE_ROLE_KEY: "s", PUBLIC_API_BASE: "https://api.example.com/" });
  assert.equal(c.supabaseUrl, "https://abc.supabase.co");
  assert.equal(c.publicApiBase, "https://api.example.com");
});
