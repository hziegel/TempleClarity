import { createHash } from "node:crypto";

// Talks to Supabase Auth over HTTP. Supabase owns passwords, sessions and tokens;
// this API only asks it "who is this token?" and, for account deletion, asks it to
// re-check a password and delete the user.
export function createSupabase({ supabaseUrl, supabaseAnonKey, supabaseServiceKey }, fetchImpl = fetch) {
  const cache = new Map(); // sha256(token) -> { user, expires }
  const TTL_MS = 30_000;

  async function getUser(token) {
    const key = createHash("sha256").update(token).digest("hex");
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) { cache.delete(key); return null; }
    if (!res.ok) throw new Error(`Supabase auth returned ${res.status}`);
    const u = await res.json();
    if (!u || !u.id) return null;
    const user = { id: u.id, email: u.email || null, emailConfirmedAt: u.email_confirmed_at || u.confirmed_at || null };
    cache.set(key, { user, expires: Date.now() + TTL_MS });
    if (cache.size > 1000) for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 500) break; }
    return user;
  }

  // True when email + password are correct. Uses the normal password grant.
  async function verifyPassword(email, password) {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return true;
    if (res.status === 400 || res.status === 401 || res.status === 422) return false;
    throw new Error(`Supabase password check returned ${res.status}`);
  }

  async function deleteUser(userId) {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase user delete returned ${res.status}`);
    cache.clear();
  }

  return { getUser, verifyPassword, deleteUser };
}
