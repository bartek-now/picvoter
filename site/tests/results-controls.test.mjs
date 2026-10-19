import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../public/scoring.js';

test('ignoring is reversible, persists reloads, combines with scoring modes and never writes votes', async () => {
  class Element {
    children = []; listeners = new Map(); style = {}; checked = false; value = ''; textContent = '';
    classes = new Set();
    classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    setAttribute() {}
    append(...elements) { this.children.push(...elements); }
    replaceChildren(...elements) { this.children = elements; }
    insertBefore(element, before) { this.children.splice(this.children.indexOf(before), 0, element); }
    click() {}
    focus() { document.activeElement = this; }
  }
  let elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const storage = entries => ({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  const local = new Map(), session = new Map();
  const globals = ['document', 'window', 'localStorage', 'sessionStorage', 'fetch'];
  const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
  const pairs = ['a', 'b', 'c'].map(id => ({ id, photos: [`${id}.svg`, `${id}-close.svg`] }));
  const ballots = [
    { name: 'Alex', ranking: ['a', 'b'], updatedAt: '2026-10-19T00:00:00Z' },
    { name: 'Bea', ranking: ['b'], updatedAt: '2026-10-19T00:00:00Z' },
    { name: 'Casey', ranking: ['c', 'a'], updatedAt: '2026-10-19T00:00:00Z' },
  ];
  let requests = 0, exported;
  try {
    globalThis.document = {
      createElement: () => new Element(), querySelector: element,
      querySelectorAll: () => [], addEventListener() {}, body: new Element(),
      getElementById: id => [...elements.values()].flatMap(descendants).find(node => node.id === id),
    };
    globalThis.window = { addEventListener() {} };
    globalThis.localStorage = storage(local);
    globalThis.sessionStorage = storage(session);
    globalThis.fetch = async (path, options) => {
      assert.ok(!options?.method || options.method === 'GET', 'ignoring must never submit or delete a vote');
      requests++;
      return { ok: true, json: async () => path === '/pairs.json' ? pairs : summarize(ballots, pairs) };
    };
    URL.createObjectURL = blob => { exported = blob; return 'blob:results-test'; };
    URL.revokeObjectURL = () => {};
    const emit = (node, type) => node.listeners.get(type)({ preventDefault() {} });
    const idle = () => new Promise(resolve => setImmediate(resolve));
    const scores = () => Object.fromEntries(element('#scores').children.map(row => [row.children[2].textContent, Number(row.children[3].textContent.replace(',', '.'))]));
    const checkbox = name => element('#ballots').children.find(row => row.children[0].textContent === name).children[3].children[0].children[0];
    await import('../public/results.js?controls-test=1');
    element('#key').value = 'synthetic-test-key';
    emit(element('#results-form'), 'submit'); await idle();
    assert.deepEqual(scores(), { a: 5, b: 5, c: 3 });
    assert.equal(element('#clear-ignored').disabled, true);
    checkbox('Alex').checked = true; emit(checkbox('Alex'), 'change');
    assert.deepEqual(scores(), { a: 2, b: 3, c: 3 });
    assert.equal(element('#ballots').children.length, 3);
    assert.equal(document.activeElement, checkbox('Alex'), 'keep keyboard focus after changing a selection');
    assert.deepEqual(JSON.parse(local.get('glasses-results-ignored-v1')), ['alex']);
    assert.equal(requests, 2);
    element('#average-unranked').checked = true; emit(element('#average-unranked'), 'change');
    assert.deepEqual(scores(), { a: 3.5, b: 4, c: 4.5 });
    emit(element('#export'), 'click');
    const json = JSON.parse(await exported.text());
    assert.equal(json.totalBallots, 3); assert.equal(json.countedBallots, 2); assert.equal(json.ignoredBallots, 1);
    assert.equal(json.ballots.length, 3); assert.equal(json.ballots[0].ignored, true);
    assert.equal(json.scoringMode, 'average');

    // Reload the page with fresh controls and retained browser storage.
    elements = new Map();
    await import('../public/results.js?controls-test=2'); await idle();
    assert.equal(checkbox('Alex').checked, true);
    assert.deepEqual(scores(), { a: 3.5, b: 4, c: 4.5 });
    assert.equal(element('#clear-ignored').disabled, false);
    emit(element('#clear-ignored'), 'click');
    assert.deepEqual(scores(), { a: 6.5, b: 6, c: 5.5 });
    assert.equal(checkbox('Alex').checked, false);
    assert.deepEqual(JSON.parse(local.get('glasses-results-ignored-v1')), []);
    assert.equal(element('#clear-ignored').disabled, true);
    assert.equal(requests, 4, 'clearing must not make an API request');
    elements = new Map();
    await import('../public/results.js?controls-test=3'); await idle();
    assert.equal(checkbox('Alex').checked, false);
    assert.deepEqual(scores(), { a: 6.5, b: 6, c: 5.5 });
    for (const name of ['Alex', 'Bea', 'Casey']) { checkbox(name).checked = true; emit(checkbox(name), 'change'); }
    assert.deepEqual(scores(), { a: 0, b: 0, c: 0 });
    assert.equal(element('#ballots').children.length, 3);

    localStorage.setItem = () => { throw new Error('storage blocked'); };
    emit(element('#clear-ignored'), 'click');
    assert.match(element('#ignored-status').textContent, /could not remember/);
    assert.deepEqual(scores(), { a: 6.5, b: 6, c: 5.5 });
  } finally {
    URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
