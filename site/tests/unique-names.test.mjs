import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { isNameConflict, validateBallot } from '../lib/voting.mjs';

const pairs = JSON.parse(readFileSync(new URL('../examples/pairs.json', import.meta.url)));
const input = (id, name) => ({ ballotId: id, name, ranking: [pairs[0].id] });

test('name uniqueness preserves existing votes and allows updates to the same ballot', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(new URL('../drizzle/0000_open_kronos.sql', import.meta.url), 'utf8'));
    const save = db.prepare('INSERT INTO ballots (id, name, ranking, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, ranking=excluded.ranking, updated_at=excluded.updated_at');
    save.run('first', 'Alex', '["first-choice"]', 'before');
    db.exec(readFileSync(new URL('../drizzle/0001_bright_hellfire_club.sql', import.meta.url), 'utf8'));
    assert.equal(db.prepare('SELECT count(*) AS total FROM ballots').get().total, 1);
    save.run('first', 'Alex', '["updated-choice"]', 'after');
    assert.equal(db.prepare('SELECT ranking FROM ballots WHERE id=?').get('first').ranking, '["updated-choice"]');
    for (const name of ['Alex', 'alex', 'ALEX', ' Alex ']) {
      assert.throws(() => save.run('second', name, '[]', 'now'), error => isNameConflict(error));
    }
    save.run('second', 'Alex M.', '[]', 'now');
    assert.throws(() => save.run('first', 'Alex M.', '[]', 'later'), error => isNameConflict(error));
    assert.equal(db.prepare('SELECT name FROM ballots WHERE id=?').get('first').name, 'Alex');
    assert.equal(db.prepare('SELECT count(*) AS total FROM ballots').get().total, 2);
  } finally { db.close(); }
});

test('name conflicts are recognized through wrapped D1 errors without mislabeling other failures', () => {
  const conflict = new Error("D1_ERROR: UNIQUE constraint failed: index 'ballots_name_unique': SQLITE_CONSTRAINT");
  assert.equal(isNameConflict(new Error('Failed query', { cause: conflict })), true);
  assert.equal(isNameConflict(new Error('D1 unavailable')), false);
  assert.equal(isNameConflict(new Error('UNIQUE constraint failed: ballots.id')), false);
});

test('ballot names collapse repeated whitespace while retaining display capitalization', () => {
  const ballot = validateBallot(input('11111111-1111-4111-8111-111111111111', '  Alex   M.  '), pairs);
  assert.equal(ballot.name, 'Alex M.');
});
