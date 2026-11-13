import { test } from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../src/recommender.js";

const row = (id, relevance) => ({ id, relevance });
const ids = (list) => list.map((r) => r.id);
const SORTED = { temperature: 0 };
// A small repeatable random number generator (mulberry32) so these tests give the same result every run.
function seeded(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("no emotion: everything, in id order", () => {
  assert.deepEqual(ids(recommend([row(3, 90), row(1, null), row(2, 50)], null, SORTED)), [1, 2, 3]);
});

test("emotion: highest relevance_score first", () => {
  assert.deepEqual(ids(recommend([row(1, 50), row(2, 100), row(3, 75)], "Calm", SORTED)), [2, 3, 1]);
});

test("equal scores keep id order, so the list never changes between requests", () => {
  assert.deepEqual(ids(recommend([row(5, 80), row(2, 80), row(9, 80), row(1, 90)], "Calm", SORTED)), [1, 2, 5, 9]);
});

test("activities with no score for the emotion are left out when others have one", () => {
  assert.deepEqual(ids(recommend([row(1, null), row(2, 10), row(3, null)], "Sad", SORTED)), [2]);
});

test("a score of 0 or less means never suggest it for that emotion", () => {
  assert.deepEqual(ids(recommend([row(1, 0), row(2, 40), row(3, -5)], "Mad", SORTED)), [2]);
});

test("scores come back from Postgres as numbers or numeric strings", () => {
  assert.deepEqual(ids(recommend([row(1, "20"), row(2, "100"), row(3, 60)], "Calm", SORTED)), [2, 3, 1]);
});

test("no positive score at all: fall back to every activity in id order", () => {
  assert.deepEqual(ids(recommend([row(3, null), row(1, 0), row(2, null)], "Nervous", SORTED)), [1, 2, 3]);
  assert.deepEqual(ids(recommend([], "Calm")), []);
});

test("does not change the list it is given", () => {
  const rows = [row(2, 10), row(1, 20)];
  recommend(rows, "Calm", { random: seeded(1) });
  assert.deepEqual(ids(rows), [2, 1]);
});

test("Gumbel-Max: first place goes to an activity in proportion to its score", () => {
  const rnd = seeded(42), N = 20000, wins = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < N; i++) wins[recommend([row(1, 60), row(2, 30), row(3, 10)], "Calm", { random: rnd })[0].id]++;
  // Expected shares: 0.6, 0.3, 0.1
  assert.ok(Math.abs(wins[1] / N - 0.6) < 0.02, String(wins[1] / N));
  assert.ok(Math.abs(wins[2] / N - 0.3) < 0.02, String(wins[2] / N));
  assert.ok(Math.abs(wins[3] / N - 0.1) < 0.02, String(wins[3] / N));
});

test("the order changes from one request to the next, but always lists each activity once", () => {
  const rows = [row(1, 50), row(2, 50), row(3, 50), row(4, 50), row(5, 50)];
  const rnd = seeded(7), seen = new Set();
  for (let i = 0; i < 50; i++) {
    const out = ids(recommend(rows, "Calm", { random: rnd }));
    assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5]);
    seen.add(out.join());
  }
  assert.ok(seen.size > 10);
});

test("a score of 0 stays hidden even with shuffling", () => {
  const rnd = seeded(3);
  for (let i = 0; i < 200; i++) assert.ok(!ids(recommend([row(1, 0), row(2, 40), row(3, 40)], "Mad", { random: rnd })).includes(1));
});

test("fallback with no scores shuffles every activity evenly", () => {
  const rnd = seeded(5), firsts = new Set();
  for (let i = 0; i < 100; i++) firsts.add(recommend([row(1, null), row(2, null), row(3, null)], "Nervous", { random: rnd })[0].id);
  assert.equal(firsts.size, 3);
});

test("a low temperature stays close to the score order, a high one is flatter", () => {
  const rows = [row(1, 60), row(2, 30), row(3, 10)];
  const share = (temperature) => { const rnd = seeded(11); let n = 0; for (let i = 0; i < 4000; i++) if (recommend(rows, "Calm", { temperature, random: rnd })[0].id === 1) n++; return n / 4000; };
  assert.ok(share(0.2) > 0.95);
  assert.ok(share(1) > 0.55 && share(1) < 0.65);
  assert.ok(share(5) < 0.45);
});

test("no emotion is never shuffled", () => {
  assert.deepEqual(ids(recommend([row(3, 1), row(1, 99), row(2, 50)], null, { random: seeded(9) })), [1, 2, 3]);
});

test("a constant random source gives plain score order", () => {
  assert.deepEqual(ids(recommend([row(1, 20), row(2, 90), row(3, 55)], "Calm", { random: () => 0.5 })), [2, 3, 1]);
});
