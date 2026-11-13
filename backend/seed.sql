-- Temple Clarity starting data, in the shape of schema.sql. Safe to run more than once:
-- existing rows are matched by id/title, and links are only added when missing, so
-- recommender changes (relevance scores, published flags) are never overwritten.
-- Activity ids 1-16 match the shareable links already in the front end (#activity-N).

INSERT INTO genres (title) VALUES
  ('Mindful/Meditative'),
  ('Distress Tolerance'),
  ('Drawing'),
  ('Crafting'),
  ('Writing'),
  ('Reading'),
  ('Activity Sheet'),
  ('Vocal'),
  ('Auditory'),
  ('Sensory'),
  ('Movement'),
  ('Silly'),
  ('Productive'),
  ('Game'),
  ('Food'),
  ('Social')
ON CONFLICT (title) DO NOTHING;

INSERT INTO emotions (title) VALUES
  ('Happy'),
  ('Sad'),
  ('Mad'),
  ('Scared'),
  ('Bored'),
  ('Tired'),
  ('Nervous'),
  ('Calm')
ON CONFLICT (title) DO NOTHING;

INSERT INTO activities (id, title, description, min_time, max_time, screen_only, group_only, requires_supplies, published, created_at)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'Box breathing', 'Breathe in for four counts, hold for four, out for four, hold for four. Repeat a few times, slowly.', make_interval(mins => 5), make_interval(mins => 5), false, false, false, true, now()),
  (2, 'Stretch by a window', 'Stand near natural light and stretch your arms, neck and shoulders. Notice what feels good.', make_interval(mins => 10), make_interval(mins => 10), false, false, false, true, now()),
  (3, 'Doodle a pattern', 'Grab any pen and paper and fill a small square with a repeating pattern. There is no wrong way.', make_interval(mins => 10), make_interval(mins => 10), false, false, false, true, now()),
  (4, 'Make a warm drink and sit with it', 'Brew something warm, find a comfortable spot, and drink it slowly without a screen.', make_interval(mins => 30), make_interval(mins => 30), false, false, false, true, now()),
  (5, 'Fold a paper crane', 'Follow a simple origami tutorial. The repeated folds give your hands something steady to do.', make_interval(mins => 30), make_interval(mins => 30), false, false, false, true, now()),
  (6, 'Take a slow walk with no destination', 'Leave your phone in your pocket and walk at an easy pace. Look for three things you haven''t noticed before.', make_interval(mins => 40), make_interval(mins => 40), false, false, false, true, now()),
  (7, 'Try a beginner watercolor tutorial', 'Pick a simple painting to follow along with. Let it be imperfect.', make_interval(mins => 60), make_interval(mins => 60), false, false, false, true, now()),
  (8, 'Listen to a guided meditation', 'Lie down or sit comfortably and follow a longer guided body-scan or relaxation recording.', make_interval(mins => 60), make_interval(mins => 60), false, false, false, true, now()),
  (9, 'Cook something simple from scratch', 'Choose an easy recipe and take your time with it. Enjoy the smells and the chopping.', make_interval(mins => 90), make_interval(mins => 90), false, false, false, true, now()),
  (10, 'Write down three things you noticed today', 'They can be tiny: a color, a sound, a taste. Write a sentence about each.', make_interval(mins => 10), make_interval(mins => 10), false, false, false, true, now()),
  (11, 'Read one page of something you love', 'Pick a favorite book or a short poem and read a single page slowly.', make_interval(mins => 10), make_interval(mins => 10), false, false, false, true, now()),
  (12, 'Hum along to a song you like', 'Hum or sing softly and feel the vibration in your chest. Nobody has to hear it.', make_interval(mins => 5), make_interval(mins => 5), false, false, false, true, now()),
  (13, 'Play a round of solitaire', 'Shuffle a deck of cards and play one slow game, or do a small jigsaw puzzle instead.', make_interval(mins => 30), make_interval(mins => 30), false, false, false, true, now()),
  (14, 'Dance around the room badly on purpose', 'Put on any music and move in the silliest way you can think of until you smile.', make_interval(mins => 5), make_interval(mins => 5), false, false, false, true, now()),
  (15, 'Color in a printable activity sheet', 'Print or open a coloring page or a simple puzzle sheet and fill it in at your own pace.', make_interval(mins => 30), make_interval(mins => 30), false, false, false, true, now()),
  (16, 'Send a kind message to someone', 'Think of someone you haven''t talked to in a while and send them a short, warm note.', make_interval(mins => 10), make_interval(mins => 10), false, false, false, true, now())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
  min_time = EXCLUDED.min_time, max_time = EXCLUDED.max_time;

-- Keep the id counter ahead of the explicit ids above.
SELECT setval(pg_get_serial_sequence('activities', 'id'), GREATEST((SELECT max(id) FROM activities), 1));

INSERT INTO activity_genres (activity_id, genre_id)
SELECT v.activity_id, g.id FROM (VALUES
  (1, 'Mindful/Meditative'),
  (1, 'Distress Tolerance'),
  (2, 'Movement'),
  (2, 'Sensory'),
  (3, 'Drawing'),
  (4, 'Food'),
  (4, 'Sensory'),
  (4, 'Mindful/Meditative'),
  (5, 'Crafting'),
  (6, 'Movement'),
  (6, 'Mindful/Meditative'),
  (7, 'Drawing'),
  (7, 'Crafting'),
  (8, 'Mindful/Meditative'),
  (8, 'Auditory'),
  (9, 'Food'),
  (9, 'Productive'),
  (10, 'Writing'),
  (11, 'Reading'),
  (12, 'Vocal'),
  (13, 'Game'),
  (14, 'Silly'),
  (14, 'Movement'),
  (15, 'Activity Sheet'),
  (15, 'Drawing'),
  (16, 'Social'),
  (16, 'Writing')
) AS v(activity_id, genre) JOIN genres g ON g.title = v.genre
WHERE NOT EXISTS (SELECT 1 FROM activity_genres x WHERE x.activity_id = v.activity_id AND x.genre_id = g.id);

-- Placeholder relevance: the first emotion listed for each activity scores 100, then 90, 80...
-- Replace with real scores from the recommender.
INSERT INTO activity_emotions (activity_id, emotion_id, relevance_score)
SELECT v.activity_id, e.id, v.score FROM (VALUES
  (1, 'Nervous', 100),
  (1, 'Scared', 90),
  (1, 'Mad', 80),
  (1, 'Calm', 70),
  (2, 'Tired', 100),
  (2, 'Bored', 90),
  (2, 'Sad', 80),
  (3, 'Bored', 100),
  (3, 'Happy', 90),
  (3, 'Nervous', 80),
  (4, 'Tired', 100),
  (4, 'Sad', 90),
  (4, 'Calm', 80),
  (5, 'Nervous', 100),
  (5, 'Bored', 90),
  (5, 'Mad', 80),
  (6, 'Mad', 100),
  (6, 'Sad', 90),
  (6, 'Scared', 80),
  (7, 'Bored', 100),
  (7, 'Happy', 90),
  (7, 'Calm', 80),
  (7, 'Sad', 70),
  (8, 'Scared', 100),
  (8, 'Nervous', 90),
  (8, 'Tired', 80),
  (9, 'Happy', 100),
  (9, 'Bored', 90),
  (9, 'Calm', 80),
  (10, 'Sad', 100),
  (10, 'Calm', 90),
  (10, 'Happy', 80),
  (10, 'Bored', 70),
  (11, 'Tired', 100),
  (11, 'Calm', 90),
  (11, 'Sad', 80),
  (11, 'Nervous', 70),
  (12, 'Nervous', 100),
  (12, 'Mad', 90),
  (12, 'Happy', 80),
  (12, 'Bored', 70),
  (13, 'Bored', 100),
  (13, 'Nervous', 90),
  (13, 'Mad', 80),
  (14, 'Happy', 100),
  (14, 'Bored', 90),
  (14, 'Mad', 80),
  (14, 'Sad', 70),
  (15, 'Bored', 100),
  (15, 'Tired', 90),
  (15, 'Nervous', 80),
  (15, 'Calm', 70),
  (16, 'Sad', 100),
  (16, 'Tired', 90),
  (16, 'Happy', 80)
) AS v(activity_id, emotion, score) JOIN emotions e ON e.title = v.emotion
WHERE NOT EXISTS (SELECT 1 FROM activity_emotions x WHERE x.activity_id = v.activity_id AND x.emotion_id = e.id);
