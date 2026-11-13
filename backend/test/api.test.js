import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { createSupabase } from "../src/supabase.js";
import { Q } from "../src/queries.js";

// ---- in-memory stand-ins for Postgres and Supabase ----------------------------------
const ACTS = [
  { id: 1, bucket: "short", minutes: 5, title: "A", description: "a", genres: ["Drawing"], emotions: ["Calm", "Sad"], rank: 1, active: true },
  { id: 2, bucket: "short", minutes: 10, title: "B", description: "b", genres: [], emotions: ["Happy"], rank: 2, active: true },
  { id: 3, bucket: "long", minutes: 60, title: "C", description: "c", genres: [], emotions: ["Calm"], rank: 3, active: true },
];
function makeDb() {
  const st = { reactions: [], terms: [], logs: [] };
  const run = async (sql, p = []) => {
    switch (sql) {
      case Q.activitiesByBucket: return { rows: ACTS.filter((a) => a.active && (p[0] == null || a.bucket === p[0])).sort((x, y) => x.rank - y.rank || x.id - y.id) };
      case Q.activityById: return { rows: ACTS.filter((a) => a.active && a.id === p[0]) };
      case Q.reactionsForUser: return { rows: st.reactions.filter((r) => r.user_id === p[0]).map(({ activity_id, fav, vote }) => ({ activity_id, fav, vote })) };
      case Q.reactionForUpdate: return { rows: st.reactions.filter((r) => r.user_id === p[0] && r.activity_id === p[1]).map(({ fav, vote }) => ({ fav, vote })) };
      case Q.reactionUpsert: {
        st.reactions = st.reactions.filter((r) => !(r.user_id === p[0] && r.activity_id === p[1]));
        st.reactions.push({ user_id: p[0], activity_id: p[1], fav: p[2], vote: p[3] }); return { rows: [] };
      }
      case Q.reactionDelete: st.reactions = st.reactions.filter((r) => !(r.user_id === p[0] && r.activity_id === p[1])); return { rows: [] };
      case Q.termsInsert: if (!st.terms.some((t) => t.user_id === p[0] && t.version === p[1])) st.terms.push({ user_id: p[0], version: p[1] }); return { rows: [] };
      case Q.userReactionsDelete: st.reactions = st.reactions.filter((r) => r.user_id !== p[0]); return { rows: [] };
      case Q.userTermsDelete: st.terms = st.terms.filter((t) => t.user_id !== p[0]); return { rows: [] };
      case Q.errorLogInsert: st.logs.push(p); return { rows: [] };
      default: throw new Error("unknown query: " + sql);
    }
  };
  return { st, query: run, tx: (fn) => fn(run) };
}
const USERS = { "good-token": { id: "u-1", email: "heron@example.com" }, "other-token": { id: "u-2", email: "other@example.com" } };
function makeSupabase() {
  const s = { deleted: [], failDelete: false };
  return {
    s,
    getUser: async (t) => USERS[t] || null,
    verifyPassword: async (email, pw) => email === "heron@example.com" && pw === "right-password",
    deleteUser: async (id) => { if (s.failDelete) throw new Error("boom"); s.deleted.push(id); },
  };
}

let server, base, db, sb;
before(async () => {
  db = makeDb(); sb = makeSupabase();
  server = createServer({ db, supabase: sb, config: { allowedOrigins: ["https://templeclarity.com"], trustProxy: false, serveStatic: false } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = async (method, path, { token, body, headers } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
};

test("health and unknown routes", async () => {
  assert.deepEqual((await call("GET", "/api/health")).json, { ok: true });
  assert.equal((await call("GET", "/api/nope")).status, 404);
});

test("activities: bucket filter, emotion ranking and fallback", async () => {
  assert.deepEqual((await call("GET", "/api/activities")).json.activities.map((a) => a.id), [1, 2, 3]);
  assert.deepEqual((await call("GET", "/api/activities?bucket=short")).json.activities.map((a) => a.id), [1, 2]);
  assert.deepEqual((await call("GET", "/api/activities?bucket=short&emotion=Happy")).json.activities.map((a) => a.id), [2]);
  assert.deepEqual((await call("GET", "/api/activities?bucket=short&emotion=Nervous")).json.activities.map((a) => a.id), [1, 2]); // none tagged: whole pool
  assert.equal((await call("GET", "/api/activities?bucket=huge")).status, 400);
  assert.equal("rank" in (await call("GET", "/api/activities/1")).json.activity, false);
  assert.equal((await call("GET", "/api/activities/99")).status, 404);
  assert.equal((await call("GET", "/api/activities/0")).status, 400);
});

test("session returns the user or null, never an error", async () => {
  assert.deepEqual((await call("GET", "/api/session")).json, { user: null });
  assert.deepEqual((await call("GET", "/api/session", { token: "bad" })).json, { user: null });
  assert.deepEqual((await call("GET", "/api/session", { token: "good-token" })).json, { user: { id: "u-1", email: "heron@example.com" } });
});

test("reactions need login, merge partial updates and clean up empty rows", async () => {
  assert.equal((await call("GET", "/api/reactions")).status, 401);
  assert.equal((await call("PUT", "/api/reactions/1", { body: { fav: true } })).status, 401);
  assert.deepEqual((await call("PUT", "/api/reactions/1", { token: "good-token", body: { fav: true } })).json.reaction, { fav: true, vote: null });
  assert.deepEqual((await call("PUT", "/api/reactions/1", { token: "good-token", body: { vote: "up" } })).json.reaction, { fav: true, vote: "up" });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "good-token" })).json.reactions, { 1: { fav: true, vote: "up" } });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "other-token" })).json.reactions, {}); // private to each user
  await call("PUT", "/api/reactions/1", { token: "good-token", body: { fav: false, vote: null } });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "good-token" })).json.reactions, {});
  assert.equal(db.st.reactions.length, 0);
});

test("reactions reject bad input", async () => {
  const put = (id, body) => call("PUT", `/api/reactions/${id}`, { token: "good-token", body });
  assert.equal((await put(1, {})).status, 400);
  assert.equal((await put(1, { fav: "yes" })).status, 400);
  assert.equal((await put(1, { vote: "sideways" })).status, 400);
  assert.equal((await put(99, { fav: true })).status, 404);
  assert.equal((await put("abc", { fav: true })).status, 404); // route needs digits
  assert.equal((await call("PUT", "/api/reactions/1", { token: "good-token", body: "{not json" })).status, 400);
});

test("terms acceptance is recorded once per version", async () => {
  assert.equal((await call("POST", "/api/terms-acceptance", { body: { version: "2026-11-11" } })).status, 401);
  assert.equal((await call("POST", "/api/terms-acceptance", { token: "good-token", body: { version: "latest" } })).status, 400);
  assert.equal((await call("POST", "/api/terms-acceptance", { token: "good-token", body: { version: "2026-11-11" } })).status, 204);
  assert.equal((await call("POST", "/api/terms-acceptance", { token: "good-token", body: { version: "2026-11-11" } })).status, 204);
  assert.equal(db.st.terms.length, 1);
});

test("delete account: wrong password changes nothing, right password removes everything", async () => {
  await call("PUT", "/api/reactions/2", { token: "good-token", body: { fav: true } });
  await call("PUT", "/api/reactions/2", { token: "other-token", body: { fav: true } });
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: {} })).status, 400);
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: { password: "nope" } })).status, 403);
  assert.equal(sb.s.deleted.length, 0);
  assert.ok(db.st.reactions.some((r) => r.user_id === "u-1"));
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: { password: "right-password" } })).status, 204);
  assert.deepEqual(sb.s.deleted, ["u-1"]);
  assert.equal(db.st.reactions.some((r) => r.user_id === "u-1"), false);
  assert.equal(db.st.terms.some((t) => t.user_id === "u-1"), false);
  assert.ok(db.st.reactions.some((r) => r.user_id === "u-2"), "other users are untouched");
});

test("delete account reports a partial failure honestly", async () => {
  sb.s.failDelete = true;
  const r = await call("DELETE", "/api/account", { token: "good-token", body: { password: "right-password" } });
  sb.s.failDelete = false;
  assert.equal(r.status, 502);
  assert.match(r.json.error, /try again/i);
});

test("error log: stores scrubbed entries, caps size, rejects junk, rate limits", async () => {
  const ok = await call("POST", "/api/log", { body: [{ level: "warn", source: "audio", message: "failed for jane@example.com", context: { n: 3, who: "x@y.co" }, stack: "s", route: "about", count: 4, time: "2026-11-12T10:00:00Z" }] });
  assert.equal(ok.status, 204);
  const row = db.st.logs.at(-1);
  assert.equal(row[0], "warn"); assert.equal(row[2], "failed for [email]");
  assert.deepEqual(JSON.parse(row[3]), { n: 3, who: "[email]" });
  assert.equal(row[6], 4);
  assert.equal((await call("POST", "/api/log", { body: { entries: [{ message: "x" }] } })).status, 204);
  assert.equal((await call("POST", "/api/log", { body: { nope: 1 } })).status, 400);
  assert.equal((await call("POST", "/api/log", { body: "x".repeat(30_000) })).status, 413);
  const before = db.st.logs.length;
  await call("POST", "/api/log", { body: Array.from({ length: 50 }, () => ({ message: "m" })) });
  assert.equal(db.st.logs.length - before, 20, "at most 20 entries per request");
  let last;
  for (let i = 0; i < 30; i++) last = await call("POST", "/api/log", { body: [] });
  assert.equal(last.status, 429);
});

test("CORS only for allowed origins", async () => {
  const good = await call("GET", "/api/health", { headers: { Origin: "https://templeclarity.com" } });
  assert.equal(good.headers.get("access-control-allow-origin"), "https://templeclarity.com");
  const bad = await call("GET", "/api/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const pre = await call("OPTIONS", "/api/reactions/1", { headers: { Origin: "https://templeclarity.com" } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers"), /Authorization/);
});

test("supabase client: token cache, 401 handling, password check, delete", async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push([url, opts?.method || "GET"]);
    if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer ok" ? new Response(JSON.stringify({ id: "u", email: "e@x.co" })) : new Response("{}", { status: 401 });
    if (url.includes("grant_type=password")) return JSON.parse(opts.body).password === "pw" ? new Response("{}") : new Response("{}", { status: 400 });
    if (url.includes("/admin/users/")) return new Response(null, { status: url.endsWith("/gone") ? 404 : 200 });
    return new Response(null, { status: 500 });
  };
  const sb2 = createSupabase({ supabaseUrl: "https://p.supabase.co", supabaseAnonKey: "anon", supabaseServiceKey: "svc" }, fake);
  assert.deepEqual(await sb2.getUser("ok"), { id: "u", email: "e@x.co" });
  await sb2.getUser("ok");
  assert.equal(calls.filter((c) => c[0].endsWith("/auth/v1/user")).length, 1, "second lookup is cached");
  assert.equal(await sb2.getUser("nope"), null);
  assert.equal(await sb2.verifyPassword("e@x.co", "pw"), true);
  assert.equal(await sb2.verifyPassword("e@x.co", "bad"), false);
  await sb2.deleteUser("u"); await sb2.deleteUser("gone"); // 404 counts as already deleted
});
