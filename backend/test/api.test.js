import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { createSupabase } from "../src/supabase.js";
import { Q } from "../src/queries.js";

// ---- in-memory stand-ins for Postgres and Supabase ----------------------------------
const ACTS = [
  { id: 1, title: "A", description: "a", min_minutes: 5, max_minutes: 5, genres: ["Drawing"], emotions: ["Calm", "Sad"], scores: { Calm: 100, Sad: 90 } },
  { id: 2, title: "B", description: "b", min_minutes: 10, max_minutes: 10, genres: [], emotions: ["Happy"], scores: { Happy: 100 } },
  { id: 3, title: "C", description: "c", min_minutes: 60, max_minutes: 60, genres: [], emotions: ["Calm"], scores: { Calm: 60 } },
  { id: 4, title: "D", description: "d", min_minutes: 10, max_minutes: 30, genres: [], emotions: ["Calm"], scores: { Calm: 95 } }, // spans short and medium
];
function makeDb() {
  const st = { links: new Map(), users: new Map(), profiles: new Map(), favs: [], ups: [], downs: [], logs: [], nextId: 100 };
  const act = (a, emotion) => ({ ...a, screen_only: false, group_only: false, requires_supplies: false, relevance: emotion ? a.scores[emotion] ?? null : null });
  const mine = (arr, uid, aid) => arr.some((r) => r.user_id === uid && r.activity_id === aid);
  const drop = (name, uid, aid) => { st[name] = st[name].filter((r) => !(r.user_id === uid && (aid == null || r.activity_id === aid))); };
  const run = async (sql, p = []) => {
    switch (sql) {
      case Q.activitiesList: {
        const [emotion, lo, hi] = p;
        const rows = ACTS.filter((a) => lo == null || (a.min_minutes <= hi && a.max_minutes >= lo)).map((a) => act(a, emotion));
        rows.sort((x, y) => (y.relevance ?? -1) - (x.relevance ?? -1) || x.id - y.id);
        return { rows };
      }
      case Q.activityById: return { rows: ACTS.filter((a) => a.id === p[1]).map((a) => act(a, null)) };
      case Q.userIdBySupabase: return { rows: st.links.has(p[0]) ? [{ user_id: st.links.get(p[0]) }] : [] };
      case Q.lockText: case Q.lockUser: return { rows: [] };
      case Q.userNextId: return { rows: [{ id: st.nextId++ }] };
      case Q.profileInsert: st.profiles.set(p[0], { background_art: 1, music_on: true, country: null }); return { rows: [] };
      case Q.userInsert: st.users.set(p[0], { id: p[0], email: p[1], verified: p[2], terms_accepted: null, terms_version: null, password_hash: "!supabase" }); return { rows: [] };
      case Q.supabaseLinkInsert: st.links.set(p[0], p[1]); return { rows: [] };
      case Q.userTouch: Object.assign(st.users.get(p[0]), { email: p[1], seen: true }); return { rows: [] };
      case Q.termsAccept: Object.assign(st.users.get(p[0]), { terms_accepted: true, terms_version: p[1] }); return { rows: [] };
      case Q.profileGet: return { rows: st.profiles.has(p[0]) ? [st.profiles.get(p[0])] : [] };
      case Q.profileUpdate: {
        const cur = st.profiles.get(p[0]);
        if (p[1]) cur.background_art = p[2]; if (p[3]) cur.music_on = p[4]; if (p[5]) cur.country = p[6];
        return { rows: [{ ...cur }] };
      }
      case Q.reactionsForUser: return { rows: [
        ...st.favs.filter((r) => r.user_id === p[0]).map((r) => ({ activity_id: r.activity_id, fav: true, vote: null })),
        ...st.ups.filter((r) => r.user_id === p[0]).map((r) => ({ activity_id: r.activity_id, fav: false, vote: "up" })),
        ...st.downs.filter((r) => r.user_id === p[0]).map((r) => ({ activity_id: r.activity_id, fav: false, vote: "down" })),
      ] };
      case Q.reactionState: return { rows: [{ fav: mine(st.favs, p[0], p[1]), vote: mine(st.ups, p[0], p[1]) ? "up" : mine(st.downs, p[0], p[1]) ? "down" : null }] };
      case Q.favInsert: if (!mine(st.favs, p[0], p[1])) st.favs.push({ user_id: p[0], activity_id: p[1] }); return { rows: [] };
      case Q.upInsert: if (!mine(st.ups, p[0], p[1])) st.ups.push({ user_id: p[0], activity_id: p[1] }); return { rows: [] };
      case Q.downInsert: if (!mine(st.downs, p[0], p[1])) st.downs.push({ user_id: p[0], activity_id: p[1] }); return { rows: [] };
      case Q.favDelete: drop("favs", p[0], p[1]); return { rows: [] };
      case Q.upDelete: drop("ups", p[0], p[1]); return { rows: [] };
      case Q.downDelete: drop("downs", p[0], p[1]); return { rows: [] };
      case Q.deleteFavorites: drop("favs", p[0]); return { rows: [] };
      case Q.deleteUpvotes: drop("ups", p[0]); return { rows: [] };
      case Q.deleteDownvotes: drop("downs", p[0]); return { rows: [] };
      case Q.deleteUserAbilities: case Q.deleteSiteEvents: return { rows: [] };
      case Q.deleteUser: st.users.delete(p[0]); for (const [k, v] of st.links) if (v === p[0]) st.links.delete(k); return { rows: [] };
      case Q.deleteProfile: st.profiles.delete(p[0]); return { rows: [] };
      case Q.errorLogInsert: st.logs.push(p); return { rows: [] };
      default: throw new Error("unknown query: " + sql);
    }
  };
  return { st, query: run, tx: (fn) => fn(run) };
}
const USERS = {
  "good-token": { id: "sb-1", email: "heron@example.com", emailConfirmedAt: "2026-11-13T10:00:00Z" },
  "other-token": { id: "sb-2", email: "other@example.com", emailConfirmedAt: null },
  "noemail-token": { id: "sb-3", email: null, emailConfirmedAt: null },
};
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
const ids = (r) => r.json.activities.map((a) => a.id);

test("health and unknown routes", async () => {
  assert.deepEqual((await call("GET", "/api/health")).json, { ok: true });
  assert.equal((await call("GET", "/api/nope")).status, 404);
});

test("activities: time windows overlap, emotions sort by relevance, unknown emotions fall back", async () => {
  assert.deepEqual(ids(await call("GET", "/api/activities")), [1, 2, 3, 4]);
  assert.deepEqual(ids(await call("GET", "/api/activities?bucket=short")), [1, 2, 4]);
  assert.deepEqual(ids(await call("GET", "/api/activities?bucket=medium")), [4]);
  assert.deepEqual(ids(await call("GET", "/api/activities?bucket=long")), [3]);
  assert.deepEqual(ids(await call("GET", "/api/activities?bucket=short&emotion=Calm")), [1, 4]); // tagged only, best score first
  assert.deepEqual(ids(await call("GET", "/api/activities?emotion=Calm")), [1, 4, 3]);
  assert.deepEqual(ids(await call("GET", "/api/activities?bucket=short&emotion=Nervous")), [1, 2, 4]); // none tagged: whole pool
  assert.equal((await call("GET", "/api/activities?bucket=huge")).status, 400);
  const a = (await call("GET", "/api/activities/4")).json.activity;
  assert.deepEqual([a.minMinutes, a.maxMinutes, a.minutes, a.screenOnly], [10, 30, 30, false]);
  assert.equal("scores" in a || "relevance" in a, false);
  assert.equal((await call("GET", "/api/activities/99")).status, 404);
  assert.equal((await call("GET", "/api/activities/0")).status, 400);
});

test("session: null without a valid token; first sign-in creates one user and profile", async () => {
  assert.deepEqual((await call("GET", "/api/session")).json, { user: null });
  assert.deepEqual((await call("GET", "/api/session", { token: "bad" })).json, { user: null });
  const first = (await call("GET", "/api/session", { token: "good-token" })).json;
  assert.deepEqual(first, { user: { id: 100, email: "heron@example.com" } });
  assert.deepEqual((await call("GET", "/api/session", { token: "good-token" })).json, first, "same person, same id");
  assert.equal(db.st.users.size, 1);
  assert.equal(db.st.profiles.has(100), true);
  assert.equal(db.st.users.get(100).password_hash, "!supabase");
  assert.equal((await call("GET", "/api/session", { token: "noemail-token" })).status, 400);
});

test("reactions need login; favorites and votes are independent; a vote switches sides", async () => {
  assert.equal((await call("GET", "/api/reactions")).status, 401);
  assert.equal((await call("PUT", "/api/reactions/1", { body: { fav: true } })).status, 401);
  const put = (id, body, token = "good-token") => call("PUT", `/api/reactions/${id}`, { token, body });
  assert.deepEqual((await put(1, { fav: true })).json.reaction, { fav: true, vote: null });
  assert.deepEqual((await put(1, { vote: "up" })).json.reaction, { fav: true, vote: "up" });
  assert.deepEqual((await put(1, { vote: "down" })).json.reaction, { fav: true, vote: "down" });
  assert.equal(db.st.ups.length, 0, "switching to down removes the upvote");
  assert.deepEqual((await put(1, { fav: true })).json.reaction, { fav: true, vote: "down" });
  assert.equal(db.st.favs.length, 1, "favoriting twice keeps one row");
  await put(2, { vote: "up" });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "good-token" })).json.reactions, { 1: { fav: true, vote: "down" }, 2: { fav: false, vote: "up" } });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "other-token" })).json.reactions, {}, "private to each user");
  await put(1, { fav: false, vote: null }); await put(2, { vote: null });
  assert.deepEqual((await call("GET", "/api/reactions", { token: "good-token" })).json.reactions, {});
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

test("profile: defaults, partial updates, validation", async () => {
  assert.equal((await call("GET", "/api/profile")).status, 401);
  assert.deepEqual((await call("GET", "/api/profile", { token: "good-token" })).json.profile, { backgroundArt: 1, musicOn: true, country: null });
  const put = (body) => call("PUT", "/api/profile", { token: "good-token", body });
  assert.deepEqual((await put({ musicOn: false })).json.profile, { backgroundArt: 1, musicOn: false, country: null });
  assert.deepEqual((await put({ country: "us", backgroundArt: 3 })).json.profile, { backgroundArt: 3, musicOn: false, country: "US" });
  assert.deepEqual((await put({ country: null })).json.profile.country, null);
  assert.equal((await put({})).status, 400);
  assert.equal((await put({ musicOn: "no" })).status, 400);
  assert.equal((await put({ country: "USA" })).status, 400);
  assert.equal((await put({ backgroundArt: 0 })).status, 400);
});

test("terms acceptance is stored on the user", async () => {
  assert.equal((await call("POST", "/api/terms-acceptance", { body: { version: "2026-11-11" } })).status, 401);
  for (const bad of ["latest", "2026-13-45", 5]) assert.equal((await call("POST", "/api/terms-acceptance", { token: "good-token", body: { version: bad } })).status, 400);
  assert.equal((await call("POST", "/api/terms-acceptance", { token: "good-token", body: { version: "2026-11-11" } })).status, 204);
  assert.deepEqual([db.st.users.get(100).terms_accepted, db.st.users.get(100).terms_version], [true, "2026-11-11"]);
});

test("delete account: wrong password changes nothing, right password removes everything", async () => {
  const put = (token, id, body) => call("PUT", `/api/reactions/${id}`, { token, body });
  await put("good-token", 2, { fav: true }); await put("good-token", 3, { vote: "up" });
  await put("other-token", 2, { fav: true });
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: {} })).status, 400);
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: { password: "nope" } })).status, 403);
  assert.equal(sb.s.deleted.length, 0);
  assert.equal(db.st.users.has(100), true);
  assert.equal((await call("DELETE", "/api/account", { token: "good-token", body: { password: "right-password" } })).status, 204);
  assert.deepEqual(sb.s.deleted, ["sb-1"]);
  const gone = (arr) => arr.some((r) => r.user_id === 100);
  assert.deepEqual([db.st.users.has(100), db.st.profiles.has(100), db.st.links.has("sb-1"), gone(db.st.favs), gone(db.st.ups), gone(db.st.downs)], [false, false, false, false, false, false]);
  assert.ok(db.st.favs.some((r) => r.user_id !== 100), "other users are untouched");
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
  assert.deepEqual(await sb2.getUser("ok"), { id: "u", email: "e@x.co", emailConfirmedAt: null });
  await sb2.getUser("ok");
  assert.equal(calls.filter((c) => c[0].endsWith("/auth/v1/user")).length, 1, "second lookup is cached");
  assert.equal(await sb2.getUser("nope"), null);
  assert.equal(await sb2.verifyPassword("e@x.co", "pw"), true);
  assert.equal(await sb2.verifyPassword("e@x.co", "bad"), false);
  await sb2.deleteUser("u"); await sb2.deleteUser("gone"); // 404 counts as already deleted
});
