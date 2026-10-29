import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function check() {
  for (const file of ['site/app.js', 'site/axis1-evidence.js', 'site/axis2-radar.js', 'site/config.js', 'scripts/serve.mjs']) {
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
  for (const model of data.axis1.models) {
    assert.equal(model.scores.length, 5);
    assert(model.name && model.scores.every(value => Number.isFinite(value) && value >= .2 && value <= .8), 'Axis 1 chart must name every model and retain all values');
  }
  for (let state = 0; state < 5; state++) {
    assert(Math.abs(data.axis1.models.reduce((sum, model) => sum + model.scores[state], 0) / 9 - data.axis1.means[state]) < 1e-12);
  }
  assert.equal(data.axis2.states.length, 5);
  assert.equal(data.axis2.roster.length, 19);
  assert.equal(new Set(data.axis2.roster.map(model => model.id)).size, 19);
  assert.deepEqual(data.axis2.radial_scale, { min: .3, max: .8, chance: .5 });
  for (const model of data.axis2.roster) {
    assert.equal(model.scores.length, 5);
    assert(model.scores.every(score => Number.isFinite(score) && score >= data.axis2.radial_scale.min && score <= data.axis2.radial_scale.max), 'Radar must not clip a model');
  }
  for (let state = 0; state < 5; state++) {
    const mean = data.axis2.roster.reduce((sum, model) => sum + model.scores[state], 0) / 19;
    assert(Math.abs(mean - data.axis2.states[state].mean_balanced_accuracy) < 1e-10, 'Radar and fleet mean must agree');
  }
  for (const task of data.tasks) {
    await access(join(root, 'public', task.image));
    await access(join(root, 'public', task.example));
  }
  for (const file of ['overview.webp', 'composition.webp', 'construction.webp', 'brand-illustration.png']) {
    await access(join(root, 'public/assets', file));
  }
  const html = await readFile(join(root, 'site/index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
  assert.equal([...html.matchAll(/data-figure="/g)].length, 3, 'Expected the three primary paper figures');
  assert(html.indexOf('id="results"') < html.indexOf('id="axes"'), 'Main board must precede the diagnostic axes');
  for (const match of html.matchAll(/href="#([^"\s]+)"/g)) {
    assert(ids.includes(match[1]), `Missing anchor #${match[1]}`);
  }
  assert(!html.includes('http://'), 'Unexpected insecure external link');
  console.info('Checks passed: syntax, 22 models, 19 metrics, task counts, assets and anchors.');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await check();
