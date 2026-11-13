import { test } from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../src/recommender.js";

const row = (id, relevance) => ({ id, relevance });
const ids = (list) => list.map((r) => r.id);

test("no emotion: everything, in id order", () => {
  assert.deepEqual(ids(recommend([row(3, 90), row(1, null), row(2, 50)], null)), [1, 2, 3]);
});

test("emotion: highest relevance_score first", () => {
  assert.deepEqual(ids(recommend([row(1, 50), row(2, 100), row(3, 75)], "Calm")), [2, 3, 1]);
});

test("equal scores keep id order, so the list never changes between requests", () => {
  assert.deepEqual(ids(recommend([row(5, 80), row(2, 80), row(9, 80), row(1, 90)], "Calm")), [1, 2, 5, 9]);
});

test("activities with no score for the emotion are left out when others have one", () => {
  assert.deepEqual(ids(recommend([row(1, null), row(2, 10), row(3, null)], "Sad")), [2]);
});

test("a score of 0 or less means never suggest it for that emotion", () => {
  assert.deepEqual(ids(recommend([row(1, 0), row(2, 40), row(3, -5)], "Mad")), [2]);
});

test("scores come back from Postgres as numbers or numeric strings", () => {
  assert.deepEqual(ids(recommend([row(1, "20"), row(2, "100"), row(3, 60)], "Calm")), [2, 3, 1]);
});

test("no positive score at all: fall back to every activity in id order", () => {
  assert.deepEqual(ids(recommend([row(3, null), row(1, 0), row(2, null)], "Nervous")), [1, 2, 3]);
  assert.deepEqual(ids(recommend([], "Calm")), []);
});

test("does not change the list it is given", () => {
  const rows = [row(2, 10), row(1, 20)];
  recommend(rows, "Calm");
  assert.deepEqual(ids(rows), [2, 1]);
});
