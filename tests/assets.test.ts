import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gazeFrames, portraitConfig, assetUrl } from '../src/portrait/config.ts';
import { poseDistance } from '../src/portrait/motion.ts';

const manifest = JSON.parse(readFileSync(new URL('../docs/gaze-video/manifest.json', import.meta.url), 'utf8'));
const cutouts = JSON.parse(readFileSync(new URL('../docs/cutout/manifest.json', import.meta.url), 'utf8'));
const sha256 = (url: string) => createHash('sha256').update(readFileSync(new URL(`../public${url}`, import.meta.url))).digest('hex');

test('both tiers ship every mapped video frame and the rebuilt blink pair with the documented hashes', () => {
  for (const tier of ['standard', 'large'] as const) {
    const frames = gazeFrames(tier);
    assert.equal(frames.length, manifest.frames.length);
    manifest.frames.forEach((entry: any, index: number) => {
      const cutout = cutouts.files[entry.name][tier];
      assert.equal(frames[index].src, cutout.url, 'load order matches the manifest');
      assert.deepEqual({ x: frames[index].x, y: frames[index].y }, { x: entry.x, y: entry.y });
      assert.equal(sha256(entry.files[tier].url), entry.files[tier].sha256, 'opaque source still matches');
      assert.equal(sha256(cutout.url), cutout.sha256);
    });
    for (const name of ['blink-half', 'blink-closed']) {
      assert.equal(cutouts.files[name][tier].url, assetUrl(name, tier));
      assert.equal(sha256(assetUrl(name, tier)), cutouts.files[name][tier].sha256);
    }
  }
  assert.equal(gazeFrames('standard')[0].src, portraitConfig.neutral, 'neutral loads first');
});

test('kept frames are distinct, inside the viewer range and free of blink frames', () => {
  const frames = gazeFrames('large');
  for (const [index, frame] of frames.entries()) {
    assert.ok(Math.abs(frame.x) <= 1 && Math.abs(frame.y) <= 1);
    for (const other of frames.slice(index + 1)) assert.ok(poseDistance(frame, other) >= manifest.settings.minSpacing);
  }
  for (const entry of manifest.frames) assert.ok(!manifest.excludedForBlink.includes(entry.videoFrame));
});

test('the sampled ring covers every viewer direction without a gap wider than 45 degrees', () => {
  const angles = gazeFrames('large').filter(frame => Math.hypot(frame.x, frame.y) > 0.5)
    .map(frame => Math.atan2(frame.y, frame.x)).sort((a, b) => a - b);
  const gaps = angles.map((angle, i) => (angles[(i + 1) % angles.length] - angle + 2 * Math.PI) % (2 * Math.PI));
  assert.ok(Math.max(...gaps) < Math.PI / 4, `largest gap ${(Math.max(...gaps) * 180 / Math.PI).toFixed(1)}°`);
});
