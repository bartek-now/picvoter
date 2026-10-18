import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sortPairs, photoCrop, photoLabel } from '../public/pair-utils.js';
import { validateBallot, summarize } from '../lib/voting.mjs';

const pairs = JSON.parse(readFileSync(new URL('../examples/pairs.json', import.meta.url)));

test('reordering frames leaves saved preferences and scores attached to the same filenames', () => {
  const ballot = validateBallot({ ballotId: '11111111-1111-4111-8111-111111111111', name: 'Alex', ranking: [pairs[7].id, pairs[5].id, pairs[0].id] }, pairs);
  const original = JSON.stringify(ballot);
  const shuffled = [pairs[0], pairs[1], pairs[2], pairs[3], pairs[4], pairs[6], pairs[7], pairs[5]];
  assert.deepEqual(summarize([ballot], shuffled), summarize([ballot], pairs));
  assert.deepEqual(sortPairs(shuffled).map(pair => pair.id), pairs.map(pair => pair.id));
  assert.equal(JSON.stringify(ballot), original);
  assert.equal(shuffled[7].id, pairs[5].id, 'sorting must not mutate the input');
});

test('adding a frame in the middle preserves old rankings and gives the new option no historical votes', () => {
  const oldBallot = validateBallot({ ballotId: '11111111-1111-4111-8111-111111111111', name: 'Alex', ranking: [pairs[7].id, pairs[5].id, pairs[0].id] }, pairs);
  const extra = { id: 'frame-05b.svg', photos: ['frame-05b.svg', 'frame-05b-close.svg'] };
  const expanded = [...pairs, extra];
  const baseline = summarize([oldBallot], pairs);
  const results = summarize([oldBallot], expanded);
  const expectedOrder = [...pairs.slice(0, 5), extra, ...pairs.slice(5)].map(pair => pair.id);
  assert.deepEqual(sortPairs(expanded).map(pair => pair.id), expectedOrder);
  assert.deepEqual(results.ballots[0].ranking, baseline.ballots[0].ranking);
  assert.equal(results.totalBallots, 1);
  for (const score of baseline.scores) {
    const updated = results.scores.find(row => row.filename === score.filename);
    assert.equal(updated.points, score.points + score.rankedVotes, 'scoring uses the current option count');
    assert.equal(updated.firstPlaceVotes, score.firstPlaceVotes);
    assert.equal(updated.frame, expectedOrder.indexOf(score.filename) + 1);
  }
  const newScore = results.scores.find(row => row.filename === extra.id);
  assert.equal(newScore.points, 0);
  assert.equal(newScore.rankedVotes, 0);
  assert.equal(newScore.frame, 6);
  assert.equal(validateBallot({ ballotId: oldBallot.id, name: oldBallot.name, ranking: JSON.parse(oldBallot.ranking) }, expanded).ranking, oldBallot.ranking);
  assert.doesNotThrow(() => validateBallot({ ballotId: oldBallot.id, name: 'Alex', ranking: expectedOrder }, expanded));
});

test('per-photo labels and crops preserve defaults for existing pairs', () => {
  assert.deepEqual(photoCrop(pairs[0], 0), pairs[0].mirrorCrop);
  assert.equal(photoCrop(pairs[0], 1), null);
  assert.equal(photoLabel(pairs[0], 1), 'Selfie');
  const custom = { ...pairs[0], photoLabels: ['Mirror close-up', 'Second angle'], photoCrops: [{ x: 0.1, y: 0.2, size: 0.4 }, { x: 0.3, y: 0.2, size: 0.4 }] };
  assert.deepEqual(photoCrop(custom, 1), custom.photoCrops[1]);
  assert.equal(photoLabel(custom, 1), 'Second angle');
});
