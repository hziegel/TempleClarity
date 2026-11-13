// Reads settings from environment variables. Required values fail fast at startup.
export function loadConfig(env = process.env) {
  const need = (name) => {
    if (!env[name]) throw new Error(`Missing required environment variable ${name}`);
    return env[name];
  };
  return {
    port: Number(env.PORT || 3000),
    databaseUrl: need("DATABASE_URL"),
    databaseSsl: env.DATABASE_SSL === "1",
    supabaseUrl: need("SUPABASE_URL").replace(/\/+$/, ""),
    supabaseAnonKey: need("SUPABASE_ANON_KEY"),
    supabaseServiceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY === "1",
    serveStatic: env.SERVE_STATIC === "1",
  };
}
