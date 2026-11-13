-- Temple Clarity starting activities. Safe to run more than once: existing rows are updated,
-- but `rank` and `active` are left alone so recommender changes aren't overwritten.
INSERT INTO activities (id, bucket, minutes, title, description, genres, emotions, rank) VALUES
  (1, 'short', 5, 'Box breathing', 'Breathe in for four counts, hold for four, out for four, hold for four. Repeat a few times, slowly.', ARRAY['Mindful/Meditative','Distress Tolerance']::text[], ARRAY['Nervous','Scared','Mad','Calm']::text[], 1),
  (2, 'short', 10, 'Stretch by a window', 'Stand near natural light and stretch your arms, neck and shoulders. Notice what feels good.', ARRAY['Movement','Sensory']::text[], ARRAY['Tired','Bored','Sad']::text[], 2),
  (3, 'short', 10, 'Doodle a pattern', 'Grab any pen and paper and fill a small square with a repeating pattern. There is no wrong way.', ARRAY['Drawing']::text[], ARRAY['Bored','Happy','Nervous']::text[], 3),
  (4, 'medium', 30, 'Make a warm drink and sit with it', 'Brew something warm, find a comfortable spot, and drink it slowly without a screen.', ARRAY['Food','Sensory','Mindful/Meditative']::text[], ARRAY['Tired','Sad','Calm']::text[], 4),
  (5, 'medium', 30, 'Fold a paper crane', 'Follow a simple origami tutorial. The repeated folds give your hands something steady to do.', ARRAY['Crafting']::text[], ARRAY['Nervous','Bored','Mad']::text[], 5),
  (6, 'medium', 40, 'Take a slow walk with no destination', 'Leave your phone in your pocket and walk at an easy pace. Look for three things you haven''t noticed before.', ARRAY['Movement','Mindful/Meditative']::text[], ARRAY['Mad','Sad','Scared']::text[], 6),
  (7, 'long', 60, 'Try a beginner watercolor tutorial', 'Pick a simple painting to follow along with. Let it be imperfect.', ARRAY['Drawing','Crafting']::text[], ARRAY['Bored','Happy','Calm','Sad']::text[], 7),
  (8, 'long', 60, 'Listen to a guided meditation', 'Lie down or sit comfortably and follow a longer guided body-scan or relaxation recording.', ARRAY['Mindful/Meditative','Auditory']::text[], ARRAY['Scared','Nervous','Tired']::text[], 8),
  (9, 'long', 90, 'Cook something simple from scratch', 'Choose an easy recipe and take your time with it. Enjoy the smells and the chopping.', ARRAY['Food','Productive']::text[], ARRAY['Happy','Bored','Calm']::text[], 9),
  (10, 'short', 10, 'Write down three things you noticed today', 'They can be tiny: a color, a sound, a taste. Write a sentence about each.', ARRAY['Writing']::text[], ARRAY['Sad','Calm','Happy','Bored']::text[], 10),
  (11, 'short', 10, 'Read one page of something you love', 'Pick a favorite book or a short poem and read a single page slowly.', ARRAY['Reading']::text[], ARRAY['Tired','Calm','Sad','Nervous']::text[], 11),
  (12, 'short', 5, 'Hum along to a song you like', 'Hum or sing softly and feel the vibration in your chest. Nobody has to hear it.', ARRAY['Vocal']::text[], ARRAY['Nervous','Mad','Happy','Bored']::text[], 12),
  (13, 'medium', 30, 'Play a round of solitaire', 'Shuffle a deck of cards and play one slow game, or do a small jigsaw puzzle instead.', ARRAY['Game']::text[], ARRAY['Bored','Nervous','Mad']::text[], 13),
  (14, 'short', 5, 'Dance around the room badly on purpose', 'Put on any music and move in the silliest way you can think of until you smile.', ARRAY['Silly','Movement']::text[], ARRAY['Happy','Bored','Mad','Sad']::text[], 14),
  (15, 'medium', 30, 'Color in a printable activity sheet', 'Print or open a coloring page or a simple puzzle sheet and fill it in at your own pace.', ARRAY['Activity Sheet','Drawing']::text[], ARRAY['Bored','Tired','Nervous','Calm']::text[], 15),
  (16, 'short', 10, 'Send a kind message to someone', 'Think of someone you haven''t talked to in a while and send them a short, warm note.', ARRAY['Social','Writing']::text[], ARRAY['Sad','Tired','Happy']::text[], 16)
ON CONFLICT (id) DO UPDATE SET bucket = EXCLUDED.bucket, minutes = EXCLUDED.minutes, title = EXCLUDED.title,
  description = EXCLUDED.description, genres = EXCLUDED.genres, emotions = EXCLUDED.emotions;
