// Run against a local built Worker with RESULTS_KEY=local-results-test.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = new URL(process.env.PICVOTER_TEST_ORIGIN || 'http://127.0.0.1:5189');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw new Error('These mutation tests must run against a local server.');
const key = 'local-results-test';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(path, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(new URL(path, origin), options);
    const text = await response.text();
    // Retry only this explicit local development-proxy failure, never API errors.
    if (response.status === 503 && text.startsWith('Your worker restarted mid-request.') && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }
    return { status: response.status, data: JSON.parse(text) };
  }
}
async function results() {
  const response = await request('/api/results', { headers });
  assert.equal(response.status, 200);
  return response.data;
}
const pairs = await (await fetch(new URL('/pairs.json', origin))).json();
const baseline = await results();
const prefix = `Deletion test ${randomUUID().slice(0, 8)}`;
const names = [`${prefix} A`, `${prefix} B`];
const ids = [randomUUID(), randomUUID()];
const save = (index, ranking) => request('/api/votes', { method: 'POST', headers, body: JSON.stringify({ ballotId: ids[index], name: names[index], ranking }) });
const remove = (ballot, customHeaders = headers) => request('/api/results', { method: 'DELETE', headers: customHeaders, body: JSON.stringify(ballot) });
try {
  assert.equal((await save(0, [pairs[0].id])).status, 200);
  assert.equal((await save(1, [pairs[1].id])).status, 200);
  const loaded = await results();
  const first = loaded.ballots.find(ballot => ballot.name === names[0]);
  const second = loaded.ballots.find(ballot => ballot.name === names[1]);
  assert.equal(loaded.totalBallots, baseline.totalBallots + 2);
  assert.ok(loaded.ballots.every(ballot => !('id' in ballot)), 'Owner results must not disclose browser ballot IDs');
  assert.equal((await remove(first, { 'Content-Type': 'application/json' })).status, 401);
  assert.equal((await remove(first, { ...headers, Authorization: 'Bearer wrong-key' })).status, 401);
  assert.equal((await remove(first, { ...headers, Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await remove(first, { Authorization: headers.Authorization })).status, 415);
  assert.equal((await remove({ name: '', updatedAt: first.updatedAt })).status, 400);
  assert.equal((await remove({ name: first.name, updatedAt: 'invalid' })).status, 400);
  assert.equal((await remove({ ...first, updatedAt: new Date(0).toISOString() })).status, 409);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await save(0, [pairs[1].id])).status, 200);
  assert.equal((await remove(first)).status, 409, 'A vote updated after loading cannot be deleted using the old snapshot');
  const latest = (await results()).ballots.find(ballot => ballot.name === names[0]);
  assert.equal((await remove(latest)).status, 200);
  assert.equal((await remove(latest)).status, 409);
  const remaining = await results();
  assert.equal(remaining.totalBallots, baseline.totalBallots + 1);
  assert.deepEqual(remaining.ballots.find(ballot => ballot.name === names[1]), second);
  for (const score of baseline.scores) {
    const updated = remaining.scores.find(row => row.filename === score.filename);
    assert.equal(updated.points, score.points + (score.filename === pairs[1].id ? pairs.length : 0));
  }
  ids[0] = randomUUID();
  assert.equal((await save(0, [pairs[0].id])).status, 200, 'Deleting a vote releases its unique name');
  console.log('Local API passed: delete authorization, origin checks, validation, stale-vote protection, single-vote deletion, score refresh, and name reuse.');
} finally {
  for (const ballot of (await results()).ballots.filter(ballot => names.includes(ballot.name))) {
    assert.equal((await remove(ballot)).status, 200);
  }
  const restored = await results();
  assert.equal(restored.totalBallots, baseline.totalBallots);
  assert.deepEqual(restored.scores, baseline.scores);
}
