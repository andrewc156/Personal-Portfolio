import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = resolve(process.argv[2]);
const data = 'public/data/colorado';
const valid = JSON.parse(readFileSync(`${data}/labels.json`, 'utf8'));
const meta = JSON.stringify(readFileSync(`${data}/meta.json`, 'utf8'));
const source = pathToFileURL(resolve('src/components/explorer/build-data.ts')).href;
const preamble = `import { readPlaceLabels } from ${JSON.stringify(source)};
import assert from 'node:assert/strict';
const meta = JSON.parse(${meta});`;
const scenarios = [
  ['missing', undefined, 'assert.equal(readPlaceLabels(meta), null)'],
  ['valid', JSON.stringify(valid), 'assert.equal(readPlaceLabels(meta).labels.length, 39)'],
  ['other-grid', JSON.stringify({ ...valid, grid: { ...valid.grid, sha256: '0'.repeat(64) } }),
    'assert.throws(() => readPlaceLabels(meta), /grid does not match/)'],
  ['malformed', '{', 'assert.throws(() => readPlaceLabels(meta), SyntaxError)'],
];
for (const [scenario, content, test] of scenarios) {
  const cwd = resolve(temp, scenario);
  mkdirSync(resolve(cwd, data), { recursive: true });
  if (content !== undefined) writeFileSync(resolve(cwd, data, 'labels.json'), content);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `${preamble}\n${test}`], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  console.log(scenario, 'passed');
}
