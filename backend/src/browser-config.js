// The settings the web page needs, sent to the browser as /config.js so none of them have to be
// written into index.html. Only values that are safe to publish go in here: the Supabase project
// address, the public ("anon" / publishable) key, and where the API lives. The service role key
// and the database URL are never included.

// "https://abc.supabase.co/rest/v1/" -> "https://abc.supabase.co" (the sign-in library adds its own paths).
export function cleanSupabaseUrl(url) {
  return String(url || "").trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
}

export function browserConfigScript(config) {
  const publicConfig = {
    apiBase: String(config.publicApiBase || "").replace(/\/+$/, ""),   // "" = the same address as the page
    supabaseUrl: cleanSupabaseUrl(config.supabaseUrl),
    supabaseAnonKey: String(config.supabaseAnonKey || ""),
  };
  return `window.TC_CONFIG = ${JSON.stringify(publicConfig)};\n`;
}
