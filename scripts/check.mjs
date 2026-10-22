import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function check() {
  for (const file of ['site/app.js', 'site/config.js', 'scripts/serve.mjs']) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const data = JSON.parse(await readFile(join(root, 'site/data/benchmark.json'), 'utf8'));
  assert.equal(data.tasks.reduce((n, task) => n + task.count, 0), 9106, 'Task counts must sum to 9,106');
  assert.equal(data.models.length, 22, 'Expected the 22 paper models');
  assert.equal(data.metrics.length, 19, 'Expected all 19 displayed Table 2 readouts');
  assert.equal(new Set(data.models.map(model => model.name)).size, 22, 'Duplicate models');
  for (const model of [...data.models, data.physician, data.random]) {
    assert.equal(model.scores.length, data.metrics.length, `Metric mismatch: ${model.name}`);
    assert(model.scores.every(n => n === null || (Number.isFinite(n) && n >= 0 && n <= 1)));
  }
  assert.equal(data.axis1.models.length, 9);
  assert.equal(data.axis1.presentations.length, 5);
  assert.equal(data.axis2.states.length, 5);
  for (const task of data.tasks) {
    await access(join(root, 'public', task.image));
    await access(join(root, 'public', task.example));
  }
  for (const file of ['overview.webp', 'composition.webp', 'construction.webp', 'brand-illustration.png', 'tracescope.pdf']) {
    await access(join(root, 'public/assets', file));
  }
  const html = await readFile(join(root, 'site/index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
  assert.equal([...html.matchAll(/data-figure="/g)].length, 3, 'Expected the three primary paper figures');
  for (const match of html.matchAll(/href="#([^"\s]+)"/g)) {
    assert(ids.includes(match[1]), `Missing anchor #${match[1]}`);
  }
  assert(!html.includes('http://'), 'Unexpected insecure external link');
  console.info('Checks passed: syntax, 22 models, 19 metrics, task counts, assets and anchors.');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await check();
