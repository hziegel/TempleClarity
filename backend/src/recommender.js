// The recommender. No machine learning: it ranks activities by the numbers stored in
// activity_emotions.relevance_score, which you set by hand (higher = recommended sooner).
//
// Rules, in order:
//   1. The time choice has already been applied by the database query, so `rows` are the
//      activities that fit the chosen time.
//   2. No emotion chosen: every activity, in id order.
//   3. Emotion chosen: only activities with a relevance_score above 0 for that emotion,
//      highest score first. Equal scores keep id order, so the list is always the same.
//      A score of 0 (or less) means "never suggest this one for this emotion".
//   4. If nothing in the time window has a positive score for that emotion (a new emotion,
//      or scores not entered yet), fall back to every activity in id order so people
//      always get something.
//
// `rows` need `id` and `relevance` (the score for the chosen emotion, or null).
export function recommend(rows, emotion) {
  const byId = (a, b) => a.id - b.id;
  if (!emotion) return rows.slice().sort(byId);
  const scored = rows.filter((r) => Number(r.relevance) > 0);
  if (!scored.length) return rows.slice().sort(byId);
  return scored.sort((a, b) => Number(b.relevance) - Number(a.relevance) || byId(a, b));
}
