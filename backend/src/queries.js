// Every SQL statement the API runs. All values are passed as parameters ($1, $2, ...).
// Written for the tables in schema.sql plus supabase_users and error_logs from schema_additions.sql.

// Shared by the activity queries: one row per published activity with its genres, emotions
// and times in minutes. $1 = emotion title (or NULL), used only to sort by relevance_score.
const ACTIVITY_COLUMNS = `
  a.id, a.title, a.description,
  (EXTRACT(EPOCH FROM a.min_time) / 60)::float8 AS min_minutes,
  (EXTRACT(EPOCH FROM a.max_time) / 60)::float8 AS max_minutes,
  a.screen_only, a.group_only, a.requires_supplies,
  COALESCE((SELECT array_agg(g.title ORDER BY g.title)
            FROM activity_genres ag JOIN genres g ON g.id = ag.genre_id
            WHERE ag.activity_id = a.id), '{}') AS genres,
  COALESCE((SELECT array_agg(e.title ORDER BY e.title)
            FROM activity_emotions ae JOIN emotions e ON e.id = ae.emotion_id
            WHERE ae.activity_id = a.id), '{}') AS emotions,
  (SELECT max(ae.relevance_score)
   FROM activity_emotions ae JOIN emotions e ON e.id = ae.emotion_id
   WHERE ae.activity_id = a.id AND e.title = $1) AS relevance`;

export const Q = {
  // $1 emotion, $2 / $3 = lowest / highest minutes of the time window (both NULL for "any").
  // An activity matches when its time range overlaps the window.
  activitiesList: `
    SELECT ${ACTIVITY_COLUMNS}
    FROM activities a
    WHERE a.published
      AND ($2::float8 IS NULL OR (
            COALESCE(EXTRACT(EPOCH FROM a.min_time) / 60, 0) <= $3::float8
        AND COALESCE(EXTRACT(EPOCH FROM a.max_time) / 60, 1e9) >= $2::float8))
    ORDER BY relevance DESC NULLS LAST, a.id`,
  activityById: `
    SELECT ${ACTIVITY_COLUMNS}
    FROM activities a WHERE a.published AND a.id = $2::int`,

  // ---- users ------------------------------------------------------------------------------
  userIdBySupabase: `SELECT user_id FROM supabase_users WHERE supabase_user_id = $1`,
  lockText: `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
  lockUser: `SELECT pg_advisory_xact_lock($1::bigint)`,
  // user_profiles.user_id references users.id, so the user comes first.
  userInsert: `
    INSERT INTO users (email, email_verified_at, password_hash, created_at, updated_at, last_seen_at, account_status)
    VALUES ($1, $2::timestamp, '!supabase', now(), now(), now(), 'active')
    RETURNING id`,
  profileInsert: `INSERT INTO user_profiles (user_id) VALUES ($1)`,
  supabaseLinkInsert: `INSERT INTO supabase_users (supabase_user_id, user_id) VALUES ($1, $2)`,
  userTouch: `
    UPDATE users
    SET last_seen_at = now(), email = $2, email_verified_at = COALESCE(email_verified_at, $3::timestamp)
    WHERE id = $1`,
  termsAccept: `
    UPDATE users SET terms_accepted = true, terms_version = $2::date, updated_at = now() WHERE id = $1`,

  // ---- profile ----------------------------------------------------------------------------
  profileGet: `SELECT background_art, music_on, country FROM user_profiles WHERE user_id = $1`,
  // $2/$4/$6 are "was this field sent?" flags so a field can be cleared as well as changed.
  profileUpdate: `
    UPDATE user_profiles SET
      background_art = CASE WHEN $2::bool THEN $3::int ELSE background_art END,
      music_on       = CASE WHEN $4::bool THEN $5::bool ELSE music_on END,
      country        = CASE WHEN $6::bool THEN $7::char(2) ELSE country END
    WHERE user_id = $1
    RETURNING background_art, music_on, country`,

  // ---- email list opt-in ---------------------------------------------------------------------
  emailListGet: `SELECT subscribed FROM email_list WHERE user_id = $1`,
  emailListSet: `
    INSERT INTO email_list (user_id, subscribed, consented_at, updated_at)
    VALUES ($1, $2::bool, CASE WHEN $2::bool THEN now() END, now())
    ON CONFLICT (user_id) DO UPDATE SET
      subscribed   = EXCLUDED.subscribed,
      consented_at = CASE WHEN EXCLUDED.subscribed AND NOT email_list.subscribed THEN now() ELSE email_list.consented_at END,
      updated_at   = now()
    RETURNING subscribed`,

  // Anyone, no account: the form on the About page. Adding an address twice changes nothing.
  subscriberUpsert: `
    INSERT INTO email_subscribers (email, subscribed, consented_at, updated_at)
    VALUES ($1, true, now(), now())
    ON CONFLICT (email) DO UPDATE SET
      consented_at = CASE WHEN email_subscribers.subscribed THEN email_subscribers.consented_at ELSE now() END,
      subscribed   = true,
      updated_at   = now()`,

  // ---- favorites, upvotes, downvotes (three tables) --------------------------------------
  reactionsForUser: `
    SELECT activity_id, true AS fav, NULL::text AS vote FROM favorites WHERE user_id = $1
    UNION ALL SELECT activity_id, false, 'up'   FROM upvotes   WHERE user_id = $1
    UNION ALL SELECT activity_id, false, 'down' FROM downvotes WHERE user_id = $1`,
  reactionState: `
    SELECT EXISTS (SELECT 1 FROM favorites WHERE user_id = $1 AND activity_id = $2) AS fav,
           CASE WHEN EXISTS (SELECT 1 FROM upvotes   WHERE user_id = $1 AND activity_id = $2) THEN 'up'
                WHEN EXISTS (SELECT 1 FROM downvotes WHERE user_id = $1 AND activity_id = $2) THEN 'down'
           END AS vote`,
  favInsert: `
    INSERT INTO favorites (user_id, activity_id, created_at) VALUES ($1, $2, now())
    ON CONFLICT (user_id, activity_id) DO NOTHING`,
  favDelete: `DELETE FROM favorites WHERE user_id = $1 AND activity_id = $2`,
  upInsert: `
    INSERT INTO upvotes (user_id, activity_id, created_at) VALUES ($1, $2, now())
    ON CONFLICT (user_id, activity_id) DO NOTHING`,
  upDelete: `DELETE FROM upvotes WHERE user_id = $1 AND activity_id = $2`,
  downInsert: `
    INSERT INTO downvotes (user_id, activity_id, created_at) VALUES ($1, $2, now())
    ON CONFLICT (user_id, activity_id) DO NOTHING`,
  downDelete: `DELETE FROM downvotes WHERE user_id = $1 AND activity_id = $2`,

  // ---- account deletion: everything that points at users first, then users itself ----------
  deleteFavorites: `DELETE FROM favorites WHERE user_id = $1`,
  deleteUpvotes: `DELETE FROM upvotes WHERE user_id = $1`,
  deleteDownvotes: `DELETE FROM downvotes WHERE user_id = $1`,
  deleteUserAbilities: `DELETE FROM user_abilities WHERE user_id = $1`,
  deleteSiteEvents: `DELETE FROM site_events WHERE user_id = $1`,
  deleteEmailList: `DELETE FROM email_list WHERE user_id = $1`,
  deleteProfile: `DELETE FROM user_profiles WHERE user_id = $1`,
  deleteUser: `DELETE FROM users WHERE id = $1`,          // also removes the supabase_users link

  // ---- error log --------------------------------------------------------------------------
  errorLogInsert: `
    INSERT INTO error_logs (level, source, message, context, stack, route, count, client_time)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
};
