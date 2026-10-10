import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gazeFrames, portraitConfig, assetUrl } from '../src/portrait/config.ts';

test('both resolution tiers contain every mapped gaze and neutral blink asset with the documented hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/gaze-v2/manifest.json', import.meta.url), 'utf8'));
  for (const tier of ['standard', 'large'] as const) {
    const frames = gazeFrames(tier);
    assert.equal(frames.length, 25);
    assert.equal(new Set(frames.map(frame => `${frame.x},${frame.y}`)).size, 25);
    for (const frame of [...manifest.frames, ...manifest.blinkFrames]) {
      const variant = frame.variants[tier];
      const bytes = readFileSync(new URL(`../public${variant.url}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256);
      if (frame.x !== undefined) assert.equal(frames.find(f => f.x === frame.x && f.y === frame.y)?.src, variant.url);
    }
    assert.ok(manifest.blinkFrames.some((f: { name: string }) => assetUrl(f.name, tier).endsWith('/blink-closed.webp')));
  }
  assert.equal(portraitConfig.neutral, assetUrl('gaze-r2-c2'));
  assert.ok(readFileSync(new URL(`../public${portraitConfig.backgroundImage}`, import.meta.url)).length > 0);
});
