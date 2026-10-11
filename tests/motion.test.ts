import test from 'node:test';
import assert from 'node:assert/strict';
import { crossfadeDuration, normalizePointer, selectFrame, smoothPoint } from '../src/portrait/motion.ts';

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
  assert.equal(selectFrame(frames, { x: 0.505, y: 0 }, neutral), neutral);
  assert.equal(selectFrame(frames, { x: 0.52, y: 0 }, neutral), right);
  assert.equal(selectFrame([neutral], { x: 1, y: 1 }), neutral);
});

test('tracking is centered at the drawn eye position, with independent distances to viewport edges', () => {
  const viewport = { left: 0, top: 0, width: 1200, height: 800 };
  const eye = { x: 550, y: 280 };
  assert.deepEqual(normalizePointer(550, 280, viewport, eye), { x: 0, y: 0 });
  assert.deepEqual(normalizePointer(0, 0, viewport, eye), { x: -1, y: -1 });
  assert.deepEqual(normalizePointer(1200, 800, viewport, eye), { x: 1, y: 1 });
  assert.deepEqual(normalizePointer(875, 540, viewport, eye), { x: 0.5, y: 0.5 });
});

test('dense neighboring frames switch promptly while the margin stops boundary flicker', () => {
  const frames = [0, 0.05, 0.1, 0.15].map(x => ({ x, y: 0.8, src: String(x) }));
  for (const frame of frames) assert.equal(selectFrame(frames, frame), frame);
  assert.equal(selectFrame(frames, { x: 0.03, y: 0.8 }, frames[0]), frames[0], 'inside the margin keeps the current frame');
  assert.equal(selectFrame(frames, { x: 0.04, y: 0.8 }, frames[0]), frames[1]);
  assert.equal(selectFrame(frames, { x: 0.15, y: 0.8 }, frames[0]), frames[3], 'never lags more than one step');
  assert.equal(selectFrame([frames[0]], { x: 1, y: 1 }, frames[2]), frames[0]);
});

test('neighbors cut instantly and long jumps crossfade for a bounded, distance-scaled duration', () => {
  const range = [70, 150] as const;
  assert.equal(crossfadeDuration({ x: 0.8, y: 0 }, { x: 0.85, y: 0 }, 0.15, range), 0);
  assert.equal(crossfadeDuration({ x: 0, y: 0 }, { x: 0.2, y: 0 }, 0.15, range), 70);
  assert.equal(crossfadeDuration({ x: 0, y: 0 }, { x: 0.85, y: 0 }, 0.15, range), 128);
  assert.equal(crossfadeDuration({ x: -0.85, y: 0 }, { x: 0.85, y: 0 }, 0.15, range), 150);
});
