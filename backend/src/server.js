import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Q } from "./queries.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/og-image.png": ["og-image.png", "image/png"],
  "/robots.txt": ["robots.txt", "text/plain; charset=utf-8"],
  "/sitemap.xml": ["sitemap.xml", "application/xml; charset=utf-8"],
};
const MAX_BODY = 20 * 1024;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function scrub(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .slice(0, max);
}

// Fixed-window rate limiter kept in memory (fine for a single server).
function createLimiter() {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, 60_000);
  timer.unref();
  return function limit(key, max, windowMs) {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    h.count++;
    if (h.count > max) throw new ApiError(429, "Too many requests. Please slow down.");
  };
}

// The place to plug in the real recommender: return matching activities, best first.
export function rankActivities(pool, emotion) {
  const tagged = emotion ? pool.filter((a) => a.emotions.includes(emotion)) : [];
  return tagged.length ? tagged : pool;
}

const toActivity = (r) => ({
  id: r.id, bucket: r.bucket, minutes: r.minutes, title: r.title,
  description: r.description, genres: r.genres, emotions: r.emotions,
});

export function createServer({ db, supabase, config }) {
  const limit = createLimiter();

  function clientIp(req) {
    if (config.trustProxy) {
      const xff = req.headers["x-forwarded-for"];
      if (xff) return String(xff).split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  }

  function send(res, status, body, headers = {}) {
    const isObj = body !== undefined && typeof body === "object";
    const payload = isObj ? JSON.stringify(body) : body;
    res.writeHead(status, {
      ...(isObj ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(payload);
  }

  async function readJson(req) {
    const chunks = []; let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw new ApiError(413, "Request is too large.");
      chunks.push(c);
    }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new ApiError(400, "Body must be valid JSON."); }
  }

  async function requireUser(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (!m) throw new ApiError(401, "Please log in.");
    let user;
    try { user = await supabase.getUser(m[1]); }
    catch (e) { console.error("[auth] lookup failed:", e.message); throw new ApiError(502, "Sign-in service is unavailable. Try again."); }
    if (!user) throw new ApiError(401, "Please log in again.");
    return user;
  }

  const intParam = (s) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 2147483647) throw new ApiError(400, "Invalid id.");
    return n;
  };

  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler });

  route("GET", "/api/health", async () => ({ status: 200, body: { ok: true } }));

  route("GET", "/api/activities", async ({ url }) => {
    const bucket = url.searchParams.get("bucket");
    const emotion = url.searchParams.get("emotion");
    if (bucket && !["short", "medium", "long"].includes(bucket)) throw new ApiError(400, "Invalid bucket.");
    const { rows } = await db.query(Q.activitiesByBucket, [bucket || null]);
    return { status: 200, body: { activities: rankActivities(rows.map(toActivity), emotion) } };
  });

  route("GET", "/api/activities/(\\d+)", async ({ match }) => {
    const { rows } = await db.query(Q.activityById, [intParam(match[1])]);
    if (!rows.length) throw new ApiError(404, "Activity not found.");
    return { status: 200, body: { activity: toActivity(rows[0]) } };
  });

  // Always 200: { user } when the token is valid, { user: null } otherwise.
  route("GET", "/api/session", async ({ req }) => {
    try { return { status: 200, body: { user: await requireUser(req) } }; }
    catch (e) { if (e.status === 401) return { status: 200, body: { user: null } }; throw e; }
  });

  route("GET", "/api/reactions", async ({ req }) => {
    const user = await requireUser(req);
    const { rows } = await db.query(Q.reactionsForUser, [user.id]);
    const reactions = {};
    for (const r of rows) reactions[r.activity_id] = { fav: r.fav, vote: r.vote };
    return { status: 200, body: { reactions } };
  });

  route("PUT", "/api/reactions/(\\d+)", async ({ req, match }) => {
    const user = await requireUser(req);
    const activityId = intParam(match[1]);
    const body = await readJson(req);
    const hasFav = "fav" in body, hasVote = "vote" in body;
    if (!hasFav && !hasVote) throw new ApiError(400, "Send fav and/or vote.");
    if (hasFav && typeof body.fav !== "boolean") throw new ApiError(400, "fav must be true or false.");
    if (hasVote && ![null, "up", "down"].includes(body.vote)) throw new ApiError(400, 'vote must be "up", "down" or null.');
    const found = await db.query(Q.activityById, [activityId]);
    if (!found.rows.length) throw new ApiError(404, "Activity not found.");
    const result = await db.tx(async (q) => {
      const cur = (await q(Q.reactionForUpdate, [user.id, activityId])).rows[0] || { fav: false, vote: null };
      const fav = hasFav ? body.fav : cur.fav;
      const vote = hasVote ? body.vote : cur.vote;
      if (!fav && !vote) await q(Q.reactionDelete, [user.id, activityId]);
      else await q(Q.reactionUpsert, [user.id, activityId, fav, vote]);
      return { fav, vote };
    });
    return { status: 200, body: { reaction: result } };
  });

  route("POST", "/api/terms-acceptance", async ({ req }) => {
    const user = await requireUser(req);
    const { version } = await readJson(req);
    if (typeof version !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(version)) throw new ApiError(400, "Invalid terms version.");
    await db.query(Q.termsInsert, [user.id, version]);
    return { status: 204 };
  });

  route("DELETE", "/api/account", async ({ req }) => {
    const user = await requireUser(req);
    limit(`del:${user.id}`, 5, 60 * 60_000);
    const { password } = await readJson(req);
    if (typeof password !== "string" || !password) throw new ApiError(400, "Enter your password to confirm.");
    if (!user.email) throw new ApiError(400, "This account can't be confirmed with a password.");
    let ok;
    try { ok = await supabase.verifyPassword(user.email, password); }
    catch (e) { console.error("[account] password check failed:", e.message); throw new ApiError(502, "Sign-in service is unavailable. Try again."); }
    if (!ok) throw new ApiError(403, "That password isn't right.");
    await db.tx(async (q) => {
      await q(Q.userReactionsDelete, [user.id]);
      await q(Q.userTermsDelete, [user.id]);
    });
    try { await supabase.deleteUser(user.id); }
    catch (e) {
      console.error("[account] auth delete failed:", e.message);
      throw new ApiError(502, "Your saved data was removed, but the account itself couldn't be. Please try again.");
    }
    return { status: 204 };
  });

  // Receives the front end's error log. Anonymous, size-capped and rate-limited.
  route("POST", "/api/log", async ({ req, ip }) => {
    limit(`log:${ip}`, 30, 60_000);
    const body = await readJson(req);
    const list = Array.isArray(body) ? body : Array.isArray(body.entries) ? body.entries : null;
    if (!list) throw new ApiError(400, "Send an array of entries.");
    for (const e of list.slice(0, 20)) {
      if (!e || typeof e !== "object") continue;
      const ctx = {};
      if (e.context && typeof e.context === "object") {
        for (const k of Object.keys(e.context).slice(0, 8)) {
          const v = e.context[k];
          ctx[scrub(k, 30)] = typeof v === "number" || typeof v === "boolean" ? v : scrub(v, 80);
        }
      }
      const t = Date.parse(e.time);
      await db.query(Q.errorLogInsert, [
        e.level === "warn" ? "warn" : "error",
        scrub(e.source, 60) || "unknown",
        scrub(e.message, 300),
        JSON.stringify(ctx),
        scrub(e.stack, 400),
        scrub(e.route, 40),
        Math.min(Math.max(parseInt(e.count, 10) || 1, 1), 1000),
        Number.isFinite(t) ? new Date(t).toISOString() : null,
      ]);
    }
    return { status: 204 };
  });

  async function serveStatic(pathname, res) {
    const entry = STATIC_FILES[pathname];
    if (!entry) return false;
    try {
      const data = await readFile(path.join(ROOT, entry[0]));
      res.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "public, max-age=300" });
      res.end(data);
      return true;
    } catch { return false; }
  }

  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    try {
      const url = new URL(req.url, "http://localhost");
      const ip = clientIp(req);
      if (req.method === "OPTIONS") return send(res, 204);
      limit(`ip:${ip}`, 300, 60_000);
      if (config.serveStatic && req.method === "GET" && (await serveStatic(url.pathname, res))) return;
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const match = r.re.exec(url.pathname);
        if (!match) continue;
        const out = await r.handler({ req, res, url, match, ip });
        return send(res, out.status, out.body);
      }
      throw new ApiError(404, "Not found.");
    } catch (e) {
      if (e instanceof ApiError) return send(res, e.status, { error: e.message });
      console.error("[server] unexpected error:", e && e.message);
      return send(res, 500, { error: "Something went wrong." });
    }
  });
}
