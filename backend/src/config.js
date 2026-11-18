import { DEFAULT_TEMPERATURE } from "./recommender.js";
import { cleanSupabaseUrl } from "./browser-config.js";

// Reads settings from environment variables. Required values fail fast at startup.
// How much the recommender shuffles. 0 = never, 1 = scores are weights (default). See src/recommender.js.
function temperature(v) {
  if (v === undefined || v === "") return DEFAULT_TEMPERATURE;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("RECOMMENDER_TEMPERATURE must be a number, 0 or higher");
  return n;
}

export function loadConfig(env = process.env) {
  const need = (name) => {
    if (!env[name]) throw new Error(`Missing required environment variable ${name}. Add it to backend/.env (copy .env.example to .env), or set it in the environment.`);
    return env[name];
  };
  return {
    port: Number(env.PORT || 3000),
    databaseUrl: need("DATABASE_URL"),
    databaseSsl: env.DATABASE_SSL === "1",
    supabaseUrl: cleanSupabaseUrl(need("SUPABASE_URL")),
    supabaseAnonKey: need("SUPABASE_ANON_KEY"),
    supabaseServiceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY === "1",
    serveStatic: env.SERVE_STATIC === "1",
    publicApiBase: (env.PUBLIC_API_BASE || "").trim().replace(/\/+$/, ""),
    recommenderTemperature: temperature(env.RECOMMENDER_TEMPERATURE),
  };
}
