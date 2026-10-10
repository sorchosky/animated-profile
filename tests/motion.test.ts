import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePointer, selectFrame, smoothPoint } from '../src/portrait/motion.ts';

test('screen coordinates map to directional assets and clamp captured drags outside the stage', () => {
  const bounds = { left: 20, top: 10, width: 200, height: 100 };
  assert.deepEqual(normalizePointer(120, 60, bounds), { x: 0, y: 0 });
  assert.deepEqual(normalizePointer(20, 10, bounds), { x: -1, y: -1 });
  assert.deepEqual(normalizePointer(600, 200, bounds), { x: 1, y: 1 });
  assert.deepEqual(normalizePointer(0, 0, { ...bounds, width: 0 }), { x: 0, y: 0 });
});

test('damping has the same result across refresh rates', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 1, y: -1 };
  const oneStep = smoothPoint(start, target, 32, 110);
  const twoSteps = smoothPoint(smoothPoint(start, target, 16, 110), target, 16, 110);
  assert.ok(Math.abs(oneStep.x - twoSteps.x) < 1e-12);
  assert.ok(Math.abs(oneStep.y - twoSteps.y) < 1e-12);
});

test('chooses portraits by screen direction and keeps a stable frame near boundaries', () => {
  const neutral = { x: 0, y: 0, src: 'neutral' };
  const right = { x: 1, y: 0, src: 'right' };
  const upperLeft = { x: -1, y: -1, src: 'upper-left' };
  const frames = [neutral, right, upperLeft];
  assert.equal(selectFrame(frames, { x: 1, y: 0 }), right);
  assert.equal(selectFrame(frames, { x: -0.9, y: -0.8 }), upperLeft);
  assert.equal(selectFrame(frames, { x: 0.51, y: 0 }, neutral), neutral);
  assert.equal(selectFrame(frames, { x: 0.6, y: 0 }, neutral), right);
  assert.equal(selectFrame([neutral], { x: 1, y: 1 }), neutral);
});
