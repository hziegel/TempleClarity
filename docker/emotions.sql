-- The emotion names, in lower case (the site's capitalized names are matched ignoring case).
-- seed.sql leaves the emotions table to be filled by hand, so the local Docker database adds them here.
INSERT INTO emotions (title) VALUES ('happy'), ('sad'), ('mad'), ('scared'), ('bored'), ('tired'), ('nervous'), ('calm')
ON CONFLICT (title) DO NOTHING;
