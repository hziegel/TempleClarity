// Prints a psql script that runs each query in src/queries.js with real bound parameters.
import { Q } from "../src/queries.js";
const U = process.argv[2];
const one = (s) => s.replace(/\s+/g, " ").trim();
const lines = [];
const add = (q, params = []) => {
  lines.push(one(q));
  if (params.length) lines.push("\\bind " + params.map((p) => `'${p}'`).join(" "));
  lines.push(";");
};
// Division by a volatile zero only fails when the check is false (1/0 alone is folded at plan time).
const check = (sql) => lines.push(`SELECT CASE WHEN (${sql}) THEN 1 ELSE 1/(random()*0)::int END AS ok;`);

add(Q.activitiesByBucket, ["short"]);
add(Q.activityById, ["1"]);
check("SELECT count(*) = 16 FROM activities");
check("SELECT count(*) > 0 FROM activities WHERE bucket = 'short'");

// Reactions: insert, update, then clear (psql cannot bind NULL; a vote-less favorite is checked in sql.sh)
add(Q.reactionForUpdate, [U, "1"]);
add(Q.reactionUpsert, [U, "1", "false", "down"]);
add(Q.reactionUpsert, [U, "1", "true", "up"]);
add(Q.reactionsForUser, [U]);
check(`SELECT fav AND vote = 'up' FROM reactions WHERE user_id = '${U}' AND activity_id = 1`);
add(Q.reactionDelete, [U, "1"]);
check(`SELECT count(*) = 0 FROM reactions WHERE user_id = '${U}'`);

// Terms: a repeat is a no-op
add(Q.termsInsert, [U, "2026-11-11"]);
add(Q.termsInsert, [U, "2026-11-11"]);
check(`SELECT count(*) = 1 FROM terms_acceptances WHERE user_id = '${U}'`);

// Error log
add(Q.errorLogInsert, ["warn", "audio", "boom", '{"line":3}', "", "emotion-cards", "2", "2026-11-12T10:00:00Z"]);
check("SELECT count(*) = 1 FROM error_logs WHERE source = 'audio' AND context->>'line' = '3' AND count = 2");

// Account deletion
add(Q.reactionUpsert, [U, "2", "false", "down"]);
add(Q.userReactionsDelete, [U]);
add(Q.userTermsDelete, [U]);
check(`SELECT (SELECT count(*) FROM reactions WHERE user_id = '${U}') + (SELECT count(*) FROM terms_acceptances WHERE user_id = '${U}') = 0`);

console.log(lines.join("\n"));
