// Every SQL statement the API runs. All values are passed as parameters ($1, $2, ...).
export const Q = {
  activitiesByBucket: `
    SELECT id, bucket, minutes, title, description, genres, emotions
    FROM activities
    WHERE active AND ($1::text IS NULL OR bucket = $1)
    ORDER BY rank, id`,
  activityById: `
    SELECT id, bucket, minutes, title, description, genres, emotions
    FROM activities WHERE active AND id = $1`,
  reactionsForUser: `
    SELECT activity_id, fav, vote FROM reactions WHERE user_id = $1`,
  reactionForUpdate: `
    SELECT fav, vote FROM reactions WHERE user_id = $1 AND activity_id = $2 FOR UPDATE`,
  reactionUpsert: `
    INSERT INTO reactions (user_id, activity_id, fav, vote)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, activity_id)
    DO UPDATE SET fav = EXCLUDED.fav, vote = EXCLUDED.vote, updated_at = now()`,
  reactionDelete: `
    DELETE FROM reactions WHERE user_id = $1 AND activity_id = $2`,
  termsInsert: `
    INSERT INTO terms_acceptances (user_id, version)
    VALUES ($1, $2)
    ON CONFLICT (user_id, version) DO NOTHING`,
  userReactionsDelete: `DELETE FROM reactions WHERE user_id = $1`,
  userTermsDelete: `DELETE FROM terms_acceptances WHERE user_id = $1`,
  errorLogInsert: `
    INSERT INTO error_logs (level, source, message, context, stack, route, count, client_time)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
};
