import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../public/scoring.js';

const pairs = Array.from({ length: 9 }, (_, index) => ({ id: `frame-${index + 1}`, photos: [`frame-${index + 1}.svg`, `frame-${index + 1}-close.svg`] }));
const ballot = ranking => ({ name: 'Alex', ranking, updatedAt: '2026-10-19T00:00:00.000Z' });
const points = result => pairs.map(pair => result.scores.find(row => row.filename === pair.id).points);

test('a single pick keeps 9 points and unranked frames each get 4.5', () => {
  const ballots = [ballot(['frame-1'])];
  assert.deepEqual(points(summarize(ballots, pairs)), [9, 0, 0, 0, 0, 0, 0, 0, 0]);
  const result = summarize(ballots, pairs, 'average');
  assert.deepEqual(points(result), [9, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5]);
  assert.equal(result.scoringMode, 'average');
  for (const row of result.scores.filter(row => row.filename !== 'frame-1')) {
    assert.equal(row.rankedVotes, 0);
    assert.equal(row.firstPlaceVotes, 0);
    assert.deepEqual(row.ranks, Array(9).fill(0));
  }
});

test('two picks keep 9 and 8 points, and the remaining 7 share 28 points', () => {
  assert.deepEqual(points(summarize([ballot(['frame-1', 'frame-2'])], pairs, 'average')), [9, 8, 4, 4, 4, 4, 4, 4, 4]);
});

test('sharing happens per ballot, preserves the full point budget and only changes points', () => {
  const ballots = [ballot(['frame-1']), ballot(JSON.stringify(['frame-2', 'frame-3', 'frame-1']))];
  const snapshot = JSON.stringify(ballots);
  const original = summarize(ballots, pairs);
  const result = summarize(ballots, pairs, 'average');
  assert.deepEqual(points(result), [16, 13.5, 12.5, 8, 8, 8, 8, 8, 8]);
  assert.equal(result.scores.reduce((total, row) => total + row.points, 0), 90);
  assert.deepEqual(result.ballots, original.ballots);
  for (const row of result.scores) {
    const previous = original.scores.find(score => score.filename === row.filename);
    assert.deepEqual({ ...row, points: 0 }, { ...previous, points: 0 });
  }
  assert.equal(JSON.stringify(ballots), snapshot);
  assert.deepEqual(summarize(result.ballots, pairs), original, 'switching back restores the original results');
});

test('fully ranked ballots score identically in both modes without division by zero', () => {
  const ballots = [ballot(pairs.map(pair => pair.id))];
  assert.deepEqual(summarize(ballots, pairs, 'average').scores, summarize(ballots, pairs).scores);
  assert.deepEqual(points(summarize(ballots, pairs, 'average')), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(summarize([ballot(['frame-1'])], pairs.slice(0, 1), 'average').scores[0].points, 1);
});

test('an older complete ballot gives the newly added frame the unused final point', () => {
  const result = summarize([ballot(pairs.slice(0, 8).map(pair => pair.id))], pairs, 'average');
  assert.deepEqual(points(result), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const extra = result.scores.find(row => row.filename === 'frame-9');
  assert.equal(extra.rankedVotes, 0);
  assert.equal(extra.firstPlaceVotes, 0);
});

test('no ballots leave all scores at zero in either mode', () => {
  assert.deepEqual(points(summarize([], pairs, 'average')), Array(9).fill(0));
  assert.deepEqual(summarize([], [], 'average').scores, []);
});
