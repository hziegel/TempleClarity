// Only needed when this page is NOT served by the Temple Clarity backend (for example on a plain
// static host). Copy this file to config.js next to index.html and fill it in.
// When the backend serves the page, it provides /config.js itself from its .env file.
// Leave all three empty (or delete config.js) to run in local mode.
window.TC_CONFIG = {
  apiBase: "",            // "" = the same address as the page, or e.g. "https://api.templeclarity.com"
  supabaseUrl: "https://uifpkfeohlcggzalhktl.supabase.co",        // the project address only, e.g. "https://abcdefgh.supabase.co" (no /rest/v1)
  supabaseAnonKey: "sb_publishable_yYbO-hwm3UcZGnlnNJ5tgw_kO2dnRhj"     // the public key (sb_publishable_... or the anon key). Never the service_role key.
};
