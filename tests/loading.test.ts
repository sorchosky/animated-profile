import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecodeQueue } from '../src/portrait/loading.ts';

test('bounded loading pauses after in-flight decodes and resumes the remaining queue', async () => {
  let enabled = true;
  let active = 0;
  let maximum = 0;
  const seen: number[] = [];
  const pending: Array<() => void> = [];
  const loader = createDecodeQueue([0, 1, 2, 3, 4], async value => {
    active++; maximum = Math.max(maximum, active); seen.push(value);
    await new Promise<void>(resolve => pending.push(resolve));
    active--;
  }, () => enabled, 2);
  const first = loader.start();
  assert.equal(loader.start(), first, 'concurrent starts share one queue');
  assert.deepEqual(seen, [0, 1]);
  enabled = false;
  pending.splice(0).forEach(resolve => resolve());
  await first;
  assert.deepEqual(seen, [0, 1]);
  enabled = true;
  const second = loader.start();
  assert.deepEqual(seen, [0, 1, 2, 3]);
  pending.splice(0).forEach(resolve => resolve());
  await new Promise(resolve => setImmediate(resolve));
  pending.splice(0).forEach(resolve => resolve());
  await second;
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  assert.equal(maximum, 2);
});

test('failed assets do not block later frames and disabled motion starts no work', async () => {
  let enabled = false;
  const seen: number[] = [];
  const loader = createDecodeQueue([0, 1, 2], async value => {
    seen.push(value);
    if (value === 0) throw new Error('Missing frame');
  }, () => enabled, 1);
  await loader.start();
  assert.deepEqual(seen, []);
  enabled = true;
  await loader.start();
  assert.deepEqual(seen, [0, 1, 2]);
});
