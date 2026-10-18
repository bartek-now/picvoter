import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoLoader } from '../public/photo-loader.js';

function setup() {
  const pending = [];
  const commits = [];
  const failures = [];
  const loader = createPhotoLoader(() => {
    const image = {};
    const decoded = new Promise((resolve, reject) => pending.push({ image, resolve, reject }));
    image.decode = () => decoded;
    return image;
  });
  const load = (src, crop) => loader.load({ src, prepare(image) { image.crop = crop; }, onReady(image) { commits.push(image); }, onError(error) { failures.push(error); } });
  return { loader, load, pending, commits, failures };
}

test('image and crop remain off-screen until decoding finishes', async () => {
  const { load, pending, commits } = setup();
  const request = load('mirror.jpg', { size: 0.35 });
  assert.equal(commits.length, 0);
  assert.deepEqual(pending[0].image.crop, { size: 0.35 });
  pending[0].resolve();
  assert.equal(await request, true);
  assert.equal(commits[0].src, 'mirror.jpg');
  assert.deepEqual(commits[0].crop, { size: 0.35 });
});

test('fast navigation cannot display a stale image after a newer one', async () => {
  const { load, pending, commits } = setup();
  const first = load('mirror.jpg', { size: 0.35 });
  const next = load('selfie.jpg', null);
  pending[1].resolve();
  assert.equal(await next, true);
  pending[0].resolve();
  assert.equal(await first, false);
  assert.deepEqual(commits.map(image => [image.src, image.crop]), [['selfie.jpg', null]]);
});

test('closing or leaving a preview cancels its pending image', async () => {
  const { loader, load, pending, commits } = setup();
  const request = load('photo.jpg', null);
  loader.cancel();
  pending[0].resolve();
  assert.equal(await request, false);
  assert.equal(commits.length, 0);
});

test('a stale load failure cannot overwrite the current image status', async () => {
  const { load, pending, failures, commits } = setup();
  const first = load('broken.jpg', null);
  const next = load('valid.jpg', null);
  pending[1].resolve();
  await next;
  pending[0].reject(new Error('Decode failed'));
  await first;
  assert.equal(failures.length, 0);
  assert.equal(commits[0].src, 'valid.jpg');
  const broken = load('also-broken.jpg', null);
  pending[2].reject(new Error('Decode failed'));
  assert.equal(await broken, false);
  assert.equal(failures.length, 1);
});
