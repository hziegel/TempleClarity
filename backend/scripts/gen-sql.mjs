// Prints a psql script that runs every query in src/queries.js with real bound parameters
// against a database that already has schema.sql, schema_additions.sql and seed.sql.
import { Q } from "../src/queries.js";
const SB = process.argv[2];                  // a Supabase-style uuid
const one = (s) => s.replace(/\s+/g, " ").trim();
const lines = [];
// Params that start with ":" are psql variables (left unquoted); everything else is a quoted string.
const arg = (p) => (p.startsWith(":") ? p : `'${p}'`);
const run = (sql, params = [], after = "\\g") => {
  lines.push(one(sql));
  if (params.length) lines.push("\\bind " + params.map(arg).join(" ") + " " + after);
  else lines.push(after === "\\g" ? ";" : after);
};
const out = (sql, params, name) => run(sql, params, `\\gset ${name}_`);
// 1/0 alone is folded at plan time, so divide by a volatile zero: it only fails when the check is false.
const check = (label, cond) => lines.push(`SELECT CASE WHEN (${cond}) THEN 1 ELSE 1/(random()*0)::int END AS "${label}";`);

// ---- activities --------------------------------------------------------------------------
const count = (sql) => `SELECT count(*) AS n FROM (${sql}) t`;
// (psql cannot bind NULL, so these use real values; the NULL paths are exercised by the API tests)
out(count(Q.activitiesList), ["Nervous", "0", "15"], "short");
check("short activities", ":short_n = 8");
out(count(Q.activitiesList), ["Nervous", "15", "45"], "medium");
check("medium activities", ":medium_n = 5");
out(count(Q.activitiesList), ["Nervous", "45", "1000000000"], "long");
check("long activities", ":long_n = 3");
run(Q.activityById, ["Calm", "1"]);
check("seed has 16 activities, 16 genres, 8 emotions", "(SELECT count(*) FROM activities) = 16 AND (SELECT count(*) FROM genres) = 16 AND (SELECT count(*) FROM emotions) = 8");
check("emotion sorting puts the best score first", "(SELECT id FROM (" + one(Q.activitiesList).replace(/\$1/g, "'Nervous'").replace(/\$2::float8/g, "0::float8").replace(/\$3::float8/g, "1e9::float8") + ") t LIMIT 1) = 1");

// ---- first sign-in creates a user, a profile and the link ---------------------------------
run(Q.userIdBySupabase, [SB]);
run(Q.lockText, [SB]);
out(Q.userInsert, ["heron@example.com", "2026-11-13T10:00:00Z"], "u");
run(Q.profileInsert, [":u_id"]);
run(Q.supabaseLinkInsert, [SB, ":u_id"]);
out(Q.userIdBySupabase, [SB], "found");
check("user linked to supabase id", ":found_user_id = :u_id");
run(Q.userTouch, [":u_id", "heron.new@example.com", "2026-11-13T10:00:00Z"]);
check("user touched", `(SELECT email = 'heron.new@example.com' AND last_seen_at IS NOT NULL AND password_hash = '!supabase' FROM users WHERE id = :u_id)`);
run(Q.termsAccept, [":u_id", "2026-11-11"]);
check("terms recorded", `(SELECT terms_accepted AND terms_version = DATE '2026-11-11' FROM users WHERE id = :u_id)`);
run(Q.profileGet, [":u_id"]);
run(Q.profileUpdate, [":u_id", "true", "2", "true", "false", "true", "US"]);
check("profile updated", `(SELECT background_art = 2 AND music_on = false AND country = 'US' FROM user_profiles WHERE user_id = :u_id)`);
run(Q.profileUpdate, [":u_id", "false", "0", "false", "true", "false", "XX"]);   // untouched fields stay
check("profile partial update keeps other fields", `(SELECT background_art = 2 AND music_on = false AND country = 'US' FROM user_profiles WHERE user_id = :u_id)`);

// ---- favorites and votes -------------------------------------------------------------------
run(Q.lockUser, [":u_id"]);
run(Q.favInsert, [":u_id", "1"]);
run(Q.favInsert, [":u_id", "1"]);                             // twice: still one row
check("favorite stored once", `(SELECT count(*) = 1 FROM favorites WHERE user_id = :u_id)`);
run(Q.upInsert, [":u_id", "1"]);
run(Q.downInsert, [":u_id", "2"]);
run(Q.reactionsForUser, [":u_id"]);
run(Q.reactionState, [":u_id", "1"]);
out(Q.reactionState, [":u_id", "1"], "st");
check("state is favorite + up", `:'st_fav' = 't' AND :'st_vote' = 'up'`);
run(Q.upDelete, [":u_id", "1"]);
run(Q.downDelete, [":u_id", "1"]);
run(Q.favDelete, [":u_id", "1"]);
check("activity 1 cleared, activity 2 still downvoted", `(SELECT count(*) = 0 FROM favorites WHERE user_id = :u_id) AND (SELECT count(*) = 0 FROM upvotes WHERE user_id = :u_id) AND (SELECT count(*) = 1 FROM downvotes WHERE user_id = :u_id)`);

// ---- error log -----------------------------------------------------------------------------
run(Q.errorLogInsert, ["warn", "audio", "boom", '{"line":3}', "", "emotion-cards", "2", "2026-11-12T10:00:00Z"]);
check("error logged", "(SELECT count(*) = 1 FROM error_logs WHERE source = 'audio' AND context->>'line' = '3' AND count = 2)");

// ---- account deletion (order matters because of the foreign keys) -------------------------
run(Q.favInsert, [":u_id", "3"]);
run(Q.upInsert, [":u_id", "3"]);
for (const sql of [Q.deleteFavorites, Q.deleteUpvotes, Q.deleteDownvotes, Q.deleteUserAbilities, Q.deleteSiteEvents, Q.deleteProfile, Q.deleteUser]) run(sql, [":u_id"]);
check("everything about the user is gone", `(SELECT count(*) = 0 FROM users WHERE id = :u_id) AND (SELECT count(*) = 0 FROM user_profiles WHERE user_id = :u_id) AND (SELECT count(*) = 0 FROM supabase_users WHERE supabase_user_id = '${SB}') AND (SELECT count(*) = 0 FROM favorites WHERE user_id = :u_id) AND (SELECT count(*) = 0 FROM downvotes WHERE user_id = :u_id)`);
console.log(lines.join("\n"));
