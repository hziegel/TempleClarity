// The recommender. No machine learning: it ranks activities by the numbers stored in
// activity_emotions.relevance_score, which you set by hand, then shuffles the order a little
// (see "Gumbel-Max" below) so the queue is not identical every time.
//
// Rules, in order:
//   1. The time choice has already been applied by the database query, so `rows` are the
//      activities that fit the chosen time.
//   2. No emotion chosen: every activity, in id order (no shuffling).
//   3. Emotion chosen: only activities with a relevance_score above 0 for that emotion.
//      A score of 0 (or less) means "never suggest this one for this emotion".
//   4. If nothing in the time window has a positive score for that emotion (a new emotion,
//      or scores not entered yet), every activity in the window is used with equal weight,
//      so people always get something.
//   5. The chosen activities are put in order with the Gumbel-Max trick.
//
// Gumbel-Max: give each activity the key  ln(score) / temperature + G,  where G is a random
// Gumbel number, G = -ln(-ln(U)) with U uniform in (0, 1). Sorting by key, highest first,
// is the same as drawing activities one at a time without replacement where each draw picks
// an activity with probability proportional to score^(1/temperature). So the scores act as
// relative weights: an activity scored 90 is nine times as likely to come first as one
// scored 10, but not guaranteed to. Every activity still appears exactly once.
//
// temperature 1: probability is proportional to the score.
// temperature below 1: sticks closer to the score order (close to 0 is nearly sorted).
// temperature above 1: flatter, more random.
// temperature 0 (or less): no randomness, strictly highest score first, ties by id.
//
// `rows` need `id` and `relevance` (the score for the chosen emotion, or null).
export const DEFAULT_TEMPERATURE = 1;

const byId = (a, b) => a.id - b.id;

// One standard Gumbel(0, 1) number. U is kept away from 0 and 1 so the logs stay finite.
export function gumbel(random = Math.random) {
  const u = Math.min(Math.max(random(), 1e-12), 1 - 1e-12);
  return -Math.log(-Math.log(u));
}

export function recommend(rows, emotion, { temperature = DEFAULT_TEMPERATURE, random = Math.random } = {}) {
  if (!emotion) return rows.slice().sort(byId);
  const positive = rows.filter((r) => Number(r.relevance) > 0);
  const pool = positive.length ? positive : rows;
  const weight = (r) => (positive.length ? Number(r.relevance) : 1);

  if (!(temperature > 0)) {
    return pool.slice().sort((a, b) => weight(b) - weight(a) || byId(a, b));
  }
  return pool
    .map((r) => ({ r, key: Math.log(weight(r)) / temperature + gumbel(random) }))
    .sort((a, b) => b.key - a.key || byId(a.r, b.r))
    .map((x) => x.r);
}
