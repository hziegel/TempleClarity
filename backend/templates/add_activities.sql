-- Temple Clarity: add activities by hand (for testing).
-- Works in the Supabase SQL editor, psql, or any SQL client. Safe to run more than once:
-- an activity is matched by its title, so running it again updates that activity instead of
-- adding a copy, and its genre and emotion links are replaced by the ones listed here.
--
-- HOW TO USE
--   1. Copy the commented TEMPLATE block (or one of the test examples), remove the "-- " at the start
--      of each line, fill in the values, and keep the quotes and commas.
--   2. Run the whole file. The list at the bottom shows what was saved.
--
-- WHAT EACH PART MEANS
--   title              Must be unique. Shown as the card heading.
--   description        Shown on the card. Plain text; write '' for an apostrophe: 'don''t'.
--   min / max minutes  How long it takes. The site's time choices match activities whose range
--                      overlaps them: short = 0-15, medium = 15-45, long = 45 and up.
--                      The card shows the max. Use the same number twice for a fixed time.
--   screen_only        true if it needs a phone, tablet or computer.
--   group_only         true if it needs other people.
--   requires_supplies  true if it needs anything beyond what is usually at hand.
--   published          Only true activities are returned by the API. false = hidden draft.
--   genres             Any of: Mindful/Meditative, Distress Tolerance, Drawing, Crafting,
--                      Writing, Reading, Activity Sheet, Vocal, Auditory, Sensory, Movement,
--                      Silly, Productive, Game, Food, Social.   (0 or more)
--   emotions + scores  Any of: Happy, Sad, Mad, Scared, Bored, Tired, Nervous, Calm.
--                      The score is the recommender's weight for that feeling. Higher = suggested
--                      sooner (chance of coming first is proportional to the score). 0 = never
--                      suggest it for that feeling. An emotion left out is treated as "not for
--                      this feeling". Spell names exactly, or that link is silently skipped.

-- Keeps new ids from colliding with the starter activities (harmless if already correct).
SELECT setval(pg_get_serial_sequence('activities', 'id'), GREATEST((SELECT max(id) FROM activities), 1));

-- ============================== ACTIVITY (TEMPLATE: copy it, remove the "-- " at the start of each line, and fill it in) ==============================
-- WITH act AS (
--   INSERT INTO activities (title, description, min_time, max_time, screen_only, group_only, requires_supplies, published, created_at)
--   VALUES (
--     'YOUR TITLE HERE',
--     'Your description here.',
--     make_interval(mins => 5),      -- min minutes
--     make_interval(mins => 10),     -- max minutes
--     false,                         -- screen_only
--     false,                         -- group_only
--     false,                         -- requires_supplies
--     true,                          -- published
--     now()
--   )
--   ON CONFLICT (title) DO UPDATE SET
--     description = EXCLUDED.description, min_time = EXCLUDED.min_time, max_time = EXCLUDED.max_time,
--     screen_only = EXCLUDED.screen_only, group_only = EXCLUDED.group_only,
--     requires_supplies = EXCLUDED.requires_supplies, published = EXCLUDED.published
--   RETURNING id
-- ),
-- drop_genres   AS (DELETE FROM activity_genres   WHERE activity_id IN (SELECT id FROM act)),
-- drop_emotions AS (DELETE FROM activity_emotions WHERE activity_id IN (SELECT id FROM act)),
-- add_genres AS (
--   INSERT INTO activity_genres (activity_id, genre_id)
--   SELECT act.id, g.id FROM act JOIN genres g ON g.title IN ('Drawing', 'Writing')   -- genres
-- )
-- INSERT INTO activity_emotions (activity_id, emotion_id, relevance_score)
-- SELECT act.id, e.id, v.score
-- FROM act
-- JOIN (VALUES ('Calm', 90), ('Happy', 60)) AS v(emotion, score) ON true               -- emotions + scores
-- JOIN emotions e ON e.title = v.emotion;
-- ========================================================================================



-- ----- Test examples (delete these blocks, or use the cleanup at the bottom) -----

-- Test: Hum a long note
WITH act AS (
  INSERT INTO activities (title, description, min_time, max_time, screen_only, group_only, requires_supplies, published, created_at)
  VALUES ('Test: Hum a long note', 'Take a slow breath in, then hum one steady note as long as is comfortable. Feel the buzz in your chest. Repeat three times.',
          make_interval(mins => 3), make_interval(mins => 5), false, false, false, true, now())
  ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description, min_time = EXCLUDED.min_time, max_time = EXCLUDED.max_time,
    screen_only = EXCLUDED.screen_only, group_only = EXCLUDED.group_only,
    requires_supplies = EXCLUDED.requires_supplies, published = EXCLUDED.published
  RETURNING id
),
drop_genres   AS (DELETE FROM activity_genres   WHERE activity_id IN (SELECT id FROM act)),
drop_emotions AS (DELETE FROM activity_emotions WHERE activity_id IN (SELECT id FROM act)),
add_genres AS (
  INSERT INTO activity_genres (activity_id, genre_id)
  SELECT act.id, g.id FROM act JOIN genres g ON g.title IN ('Vocal', 'Mindful/Meditative')
)
INSERT INTO activity_emotions (activity_id, emotion_id, relevance_score)
SELECT act.id, e.id, v.score
FROM act
JOIN (VALUES ('Calm', 80), ('Nervous', 100), ('Mad', 50)) AS v(emotion, score) ON true
JOIN emotions e ON e.title = v.emotion;

-- Test: Write a kind note
WITH act AS (
  INSERT INTO activities (title, description, min_time, max_time, screen_only, group_only, requires_supplies, published, created_at)
  VALUES ('Test: Write a kind note', 'Write two or three kind sentences to someone you care about. You can send it or keep it.',
          make_interval(mins => 10), make_interval(mins => 20), false, false, true, true, now())
  ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description, min_time = EXCLUDED.min_time, max_time = EXCLUDED.max_time,
    screen_only = EXCLUDED.screen_only, group_only = EXCLUDED.group_only,
    requires_supplies = EXCLUDED.requires_supplies, published = EXCLUDED.published
  RETURNING id
),
drop_genres   AS (DELETE FROM activity_genres   WHERE activity_id IN (SELECT id FROM act)),
drop_emotions AS (DELETE FROM activity_emotions WHERE activity_id IN (SELECT id FROM act)),
add_genres AS (
  INSERT INTO activity_genres (activity_id, genre_id)
  SELECT act.id, g.id FROM act JOIN genres g ON g.title IN ('Writing', 'Social')
)
INSERT INTO activity_emotions (activity_id, emotion_id, relevance_score)
SELECT act.id, e.id, v.score
FROM act
JOIN (VALUES ('Happy', 90), ('Sad', 70), ('Bored', 40)) AS v(emotion, score) ON true
JOIN emotions e ON e.title = v.emotion;

-- Test: Walk and count blue things
WITH act AS (
  INSERT INTO activities (title, description, min_time, max_time, screen_only, group_only, requires_supplies, published, created_at)
  VALUES ('Test: Walk and count blue things', 'Take a slow walk, inside or out, and count everything blue you notice. See if you can reach ten.',
          make_interval(mins => 15), make_interval(mins => 60), false, false, false, true, now())
  ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description, min_time = EXCLUDED.min_time, max_time = EXCLUDED.max_time,
    screen_only = EXCLUDED.screen_only, group_only = EXCLUDED.group_only,
    requires_supplies = EXCLUDED.requires_supplies, published = EXCLUDED.published
  RETURNING id
),
drop_genres   AS (DELETE FROM activity_genres   WHERE activity_id IN (SELECT id FROM act)),
drop_emotions AS (DELETE FROM activity_emotions WHERE activity_id IN (SELECT id FROM act)),
add_genres AS (
  INSERT INTO activity_genres (activity_id, genre_id)
  SELECT act.id, g.id FROM act JOIN genres g ON g.title IN ('Movement', 'Game', 'Mindful/Meditative')
)
INSERT INTO activity_emotions (activity_id, emotion_id, relevance_score)
SELECT act.id, e.id, v.score
FROM act
JOIN (VALUES ('Bored', 100), ('Tired', 60), ('Sad', 50), ('Calm', 40)) AS v(emotion, score) ON true
JOIN emotions e ON e.title = v.emotion;


-- ----- Check what was saved: one row per activity, with its genres and emotion scores -----
SELECT a.id, a.title, a.published,
       (EXTRACT(EPOCH FROM a.min_time) / 60)::int || '-' || (EXTRACT(EPOCH FROM a.max_time) / 60)::int AS minutes,
       (SELECT string_agg(g.title, ', ' ORDER BY g.title)
          FROM activity_genres ag JOIN genres g ON g.id = ag.genre_id WHERE ag.activity_id = a.id) AS genres,
       (SELECT string_agg(e.title || ' ' || ae.relevance_score, ', ' ORDER BY ae.relevance_score DESC)
          FROM activity_emotions ae JOIN emotions e ON e.id = ae.emotion_id WHERE ae.activity_id = a.id) AS emotion_scores
FROM activities a
ORDER BY a.id DESC
LIMIT 10;


-- ----- Remove the test activities (uncomment to use) -----
-- BEGIN;
-- DELETE FROM specific_activity_abilities WHERE more_option_id IN (SELECT m.id FROM more_specific_activities m JOIN activities a ON a.id = m.activity_id WHERE a.title LIKE 'Test:%');
-- DELETE FROM more_specific_activities WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM activity_abilities  WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM activity_genres     WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM activity_emotions   WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM favorites           WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM upvotes             WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM downvotes           WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM site_events         WHERE activity_id IN (SELECT id FROM activities WHERE title LIKE 'Test:%');
-- DELETE FROM activities          WHERE title LIKE 'Test:%';
-- COMMIT;
