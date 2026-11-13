import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createSupabase } from "./supabase.js";
import { createServer } from "./server.js";

const config = loadConfig();
const db = createDb(config);
const supabase = createSupabase(config);
const server = createServer({ db, supabase, config });

server.listen(config.port, () => console.log(`Temple Clarity API listening on port ${config.port}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    server.close(() => db.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
