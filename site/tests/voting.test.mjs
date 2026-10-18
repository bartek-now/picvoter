import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBallot, summarize } from '../lib/voting.mjs';
const pairs = JSON.parse(readFileSync(new URL('../examples/pairs.json', import.meta.url)));
const vote = ranking => ({ ballotId: '11111111-1111-4111-8111-111111111111', name: '  Alex  ', ranking });
test('scores are keyed by first original filename; partial ballots give unranked zero', () => {
  const a = validateBallot(vote([pairs[1].id, pairs[0].id]), pairs);
  const b = validateBallot(vote([pairs[0].id]), pairs);
  assert.equal(a.name, 'Alex');
  const result = summarize([a, b], pairs);
  assert.equal(result.totalBallots, 2);
  assert.equal(result.scores[0].filename, pairs[0].id);
  assert.equal(result.scores[0].points, 15);
  assert.deepEqual(result.scores[0].ranks, [1, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.scores.find(row => row.filename === pairs[2].id).points, 0);
});
test('complete rankings award 8 through 1 points', () => {
  assert.deepEqual(summarize([validateBallot(vote(pairs.map(pair => pair.id)), pairs)], pairs).scores.map(row => row.points), [8, 7, 6, 5, 4, 3, 2, 1]);
});
test('rejects duplicate picks, unknown files, empty rankings and invalid names', () => {
  for (const ranking of [[], [pairs[0].id, pairs[0].id], ['unknown-photo.svg'], 'bad', null]) assert.throws(() => validateBallot(vote(ranking), pairs));
  for (const name of ['', '  ', 'a'.repeat(81), '\u0000']) assert.throws(() => validateBallot({ ...vote([pairs[0].id]), name }, pairs));
  assert.throws(() => validateBallot({ ...vote([pairs[0].id]), ballotId: 'bad' }, pairs));
});
test('example pairs have stable score keys and 16 distinct photo paths', () => {
  assert.equal(pairs.length, 8);
  assert.equal(new Set(pairs.flatMap(pair => pair.photos)).size, 16);
  for (const pair of pairs) { assert.equal(pair.id, pair.photos[0]); assert.equal(pair.photos.length, 2); }
});
test('adding frame 8 preserves existing IDs and accepts both earlier ballots and the new option', () => {
  assert.deepEqual(pairs.slice(0, 7).map(pair => pair.id), Array.from({ length: 7 }, (_, i) => `frame-0${i + 1}.svg`));
  const oldBallot = validateBallot(vote(pairs.slice(0, 7).map(pair => pair.id)), pairs);
  const newBallot = validateBallot(vote([pairs[7].id]), pairs);
  const results = summarize([oldBallot, newBallot], pairs);
  assert.equal(results.scores.find(row => row.filename === pairs[7].id).points, 8);
  assert.equal(results.ballots[0].ranking.length, 7);
  for (const pair of pairs) {
    const { x, y, size } = pair.mirrorCrop;
    assert.ok(x >= 0 && y >= 0 && size > 0 && x + size <= 1 && y + size <= 1);
  }
});
