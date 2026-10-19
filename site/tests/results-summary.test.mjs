import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../public/scoring.js';
import { summarizeResults } from '../public/results-summary.js';

const pairs = ['a', 'b', 'c'].map(id => ({ id, photos: [`${id}.svg`, `${id}-close.svg`] }));
const ballots = [
  { name: 'Alex', ranking: ['a', 'b'], updatedAt: '2026-10-19T00:00:00Z' },
  { name: 'Bea', ranking: ['b'], updatedAt: '2026-10-19T00:00:00Z' },
  { name: 'Casey', ranking: ['c', 'a'], updatedAt: '2026-10-19T00:00:00Z' },
];
const points = result => pairs.map(pair => result.scores.find(score => score.filename === pair.id).points);

test('ignored votes are excluded from scores and pick counts but retained in results', () => {
  const before = JSON.stringify(ballots);
  const result = summarizeResults(ballots, pairs, 'zero', new Set(['alex']));
  assert.deepEqual(points(result), [2, 3, 3]);
  assert.equal(result.totalBallots, 3);
  assert.equal(result.countedBallots, 2);
  assert.equal(result.ignoredBallots, 1);
  assert.deepEqual(result.ignoredVoters, ['Alex']);
  assert.deepEqual(result.ballots.map(ballot => ballot.ignored), [true, false, false]);
  assert.equal(result.ballots.length, 3);
  const a = result.scores.find(score => score.filename === 'a');
  assert.equal(a.firstPlaceVotes, 0);
  assert.equal(a.rankedVotes, 1);
  assert.deepEqual(a.ranks, [0, 1, 0]);
  assert.equal(JSON.stringify(ballots), before);
});

test('averaging shares only counted ballots points and ignores case differences', () => {
  const result = summarizeResults(ballots, pairs, 'average', [' ALEX ']);
  assert.deepEqual(points(result), [3.5, 4, 4.5]);
  assert.equal(result.scores.reduce((sum, score) => sum + score.points, 0), 12);
});

test('ignoring everyone leaves zero points and pick counts in both scoring modes', () => {
  for (const mode of ['zero', 'average']) {
    const result = summarizeResults(ballots, pairs, mode, ballots.map(ballot => ballot.name));
    assert.equal(result.countedBallots, 0);
    assert.equal(result.ignoredBallots, 3);
    assert.equal(result.ballots.length, 3);
    assert.ok(result.scores.every(score => score.points === 0 && score.firstPlaceVotes === 0 && score.rankedVotes === 0));
  }
});

test('clearing exclusions restores original scores and every ballot in both modes', () => {
  for (const mode of ['zero', 'average']) {
    const ignored = summarizeResults(ballots, pairs, mode, ['Alex', 'Bea']);
    const restored = summarizeResults(ignored.ballots, pairs, mode, []);
    assert.deepEqual(restored.scores, summarize(ballots, pairs, mode).scores);
    assert.equal(restored.countedBallots, 3);
    assert.ok(restored.ballots.every(ballot => !ballot.ignored));
  }
});

test('a missing or renamed voter does not exclude a different ballot', () => {
  const result = summarizeResults([{ ...ballots[0], name: 'Alex M.' }, ...ballots.slice(1)], pairs, 'zero', ['Alex', 'Unknown']);
  assert.equal(result.ignoredBallots, 0);
  assert.deepEqual(result.scores, summarize(ballots, pairs).scores);
});
