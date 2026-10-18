import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'site');
function copyMissing(source, target) {
  if (existsSync(target)) return;
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}
copyMissing(path.join(site, '.openai/hosting.example.json'), path.join(site, '.openai/hosting.json'));
const pairsFile = path.join(site, 'public/pairs.json');
const createDemo = !existsSync(pairsFile);
copyMissing(path.join(site, 'examples/pairs.json'), pairsFile);
if (createDemo) {
  const pairs = JSON.parse(readFileSync(pairsFile, 'utf8'));
  for (const file of pairs.flatMap(pair => pair.photos)) {
    copyMissing(path.join(site, 'examples/photo.svg'), path.join(site, 'public/photos', file));
  }
}
console.log('Local configuration is ready. Existing photos and settings were preserved.');
