import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as config from '../src/portrait/config.ts';
import * as motion from '../src/portrait/motion.ts';
import { createDecodeQueue } from '../src/portrait/loading.ts';

type Listener = (event: any) => void;
class Surface {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type: string, event: any = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}
class ElementStub extends Surface {
  classList = new class {
    values = new Set<string>();
    add(value: string) { this.values.add(value); }
    remove(value: string) { this.values.delete(value); }
    toggle(value: string, on: boolean) { if (on) this.add(value); else this.remove(value); }
    contains(value: string) { return this.values.has(value); }
  }();
  attrs = new Map<string, string>();
  children: ElementStub[] = [];
  captures = new Set<number>();
  src = ''; alt = ''; className = ''; hidden = false; disabled = false; textContent = ''; draggable = false;
  control = false; removed = false;
  style = { setProperty() {} };
  append(child: ElementStub) { this.children.push(child); }
  setAttribute(key: string, value: string) { this.attrs.set(key, value); }
  removeAttribute(key: string) { this.attrs.delete(key); }
  closest() { return this.control ? this : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1152, height: 768 }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); this.fire('lostpointercapture', { pointerId: id }); }
  remove() { this.removed = true; }
}

function setup(reduced = false, failedSuffix = '') {
  const stage = new ElementStub(), canvas = new ElementStub(), neutral = new ElementStub(), button = new ElementStub();
  neutral.src = config.portraitConfig.neutral; neutral.classList.add('is-visible'); canvas.append(neutral);
  const media = Object.assign(new Surface(), { matches: reduced });
  const document = Object.assign(new Surface(), { hidden: false, querySelector: (selector: string) => ({ '[data-portrait-stage]': stage, '[data-portrait-canvas]': canvas, '[data-neutral-portrait]': neutral, '[data-motion-toggle]': button })[selector] });
  let id = 0, time = 0, decodes = 0;
  const timers = new Map<number, { fn: () => void; delay: number }>();
  const raf = new Map<number, (time: number) => void>();
  const window = Object.assign(new Surface(), {
    innerWidth: 1200, innerHeight: 800,
    matchMedia: (query: string) => query.includes('reduced-motion') ? media : { matches: true },
    setTimeout: (fn: () => void, delay: number) => { timers.set(++id, { fn, delay }); return id; },
    clearTimeout: (key: number) => timers.delete(key),
  });
  class ImageStub extends ElementStub {
    async decode() { decodes++; if (failedSuffix && this.src.endsWith(failedSuffix)) throw new Error('missing'); }
  }
  const source = readFileSync(new URL('../src/portrait/controller.ts', import.meta.url), 'utf8').split('\n').filter(line => !line.startsWith('import ')).join('\n');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  vm.runInNewContext(js, { ...config, ...motion, createDecodeQueue, document, window, Element: ElementStub, Image: ImageStub,
    requestAnimationFrame: (fn: (time: number) => void) => { raf.set(++id, fn); return id; }, cancelAnimationFrame: (key: number) => raf.delete(key), console: { warn() {} } });
  const settle = () => { for (let n = 0; raf.size && n < 200; n++) { const batch = [...raf.values()]; raf.clear(); time += 16; batch.forEach(fn => fn(time)); } assert.equal(raf.size, 0, 'motion settles'); };
  const visible = () => canvas.children.find(image => !image.removed && image.classList.contains('is-visible'))?.src;
  return { stage, canvas, neutral, button, media, document, window, timers, raf, settle, visible, decodes: () => decodes };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const frames = config.gazeFrames('large');
const neutralSrc = config.assetUrl(config.portraitConfig.neutralName, 'large');
const eyeY = 768 * config.portraitConfig.eyeAnchor.y;
/** The frame tracking may settle on: the nearest one, or a neighbor still inside the hysteresis margin. */
function assertTracks(src: string | undefined, target: { x: number; y: number }) {
  const frame = frames.find(f => f.src === src);
  assert.ok(frame, `visible frame ${src} is a tracking frame`);
  const nearest = Math.min(...frames.map(f => motion.poseDistance(f, target)));
  assert.ok(motion.poseDistance(frame, target) <= nearest + config.portraitConfig.frameMargin);
}
const nearestTo = (target: { x: number; y: number }) => motion.selectFrame(frames, target);
const blinkTimers = (timers: Map<number, { delay: number }>) => [...timers.values()].filter(timer => timer.delay >= 3500).length;

test('reduced motion loads no animation assets; live resume enables all poses and pause restores neutral', async () => {
  const app = setup(true);
  assert.equal(app.decodes(), 0); assert.equal(app.timers.size, 0); assert.equal(app.raf.size, 0);
  assert.equal(app.visible(), config.portraitConfig.neutral);
  app.media.matches = false; app.media.fire('change'); await flush(); app.settle();
  assert.equal(app.decodes(), frames.length + 2);
  app.window.fire('pointermove', { isPrimary: true, pointerType: 'mouse', clientX: 1200, clientY: eyeY, target: app.stage }); app.settle();
  assertTracks(app.visible(), { x: 1, y: 0 }); assert.equal(blinkTimers(app.timers), 0, 'directional heads never use neutral blinks');
  assert.equal(app.timers.size, 1, 'the jump from neutral crossfades');
  app.button.fire('click');
  assert.equal(app.visible(), neutralSrc); assert.equal(app.timers.size, 0); assert.equal(app.raf.size, 0);
  assert.equal(app.canvas.classList.contains('is-animated'), false);
});

test('blur interrupts a blink and touch cancellation returns to neutral without trapping controls', async () => {
  const app = setup(); await flush(); app.settle();
  const [key, timer] = [...app.timers.entries()][0]; app.timers.delete(key); timer.fn();
  assert.ok(app.visible()?.endsWith('blink-half.webp'));
  app.window.fire('blur');
  assert.equal(app.visible(), neutralSrc); assert.equal(app.timers.size, 0);
  app.window.fire('focus');
  const pointer = { isPrimary: true, button: 0, pointerId: 4, pointerType: 'touch', clientX: 0, clientY: eyeY, target: app.stage };
  app.stage.fire('pointerdown', pointer); app.settle();
  assert.equal(app.stage.hasPointerCapture(4), true); assertTracks(app.visible(), { x: -1, y: 0 });
  app.stage.fire('pointercancel', pointer); app.settle();
  assert.equal(app.stage.hasPointerCapture(4), false); assert.equal(app.visible(), neutralSrc);
  const control = new ElementStub(); control.control = true;
  app.stage.fire('pointerdown', { ...pointer, target: control }); assert.equal(app.stage.hasPointerCapture(4), false);
  app.document.hidden = true; app.document.fire('visibilitychange'); assert.equal(app.timers.size, 0); assert.equal(app.raf.size, 0);
});

test('missing directional image retains a decoded neighboring pose', async () => {
  const missing = nearestTo({ x: 1, y: 0 }).src;
  const app = setup(false, missing); await flush(); app.settle();
  app.window.fire('pointermove', { isPrimary: true, pointerType: 'mouse', clientX: 1200, clientY: eyeY, target: app.stage }); app.settle();
  assert.ok(app.visible()); assert.notEqual(app.visible(), missing); assert.notEqual(app.visible(), neutralSrc);
});
