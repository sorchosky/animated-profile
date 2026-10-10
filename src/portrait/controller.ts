import { portraitConfig, gazeFrames, assetUrl, type PortraitFrame, type ResolutionTier } from './config.ts';
import { normalizePointer, selectFrame, smoothPoint, type Point } from './motion.ts';
import { createDecodeQueue } from './loading.ts';

const stage = document.querySelector<HTMLElement>('[data-portrait-stage]');
const canvas = document.querySelector<HTMLElement>('[data-portrait-canvas]');
const neutralImage = document.querySelector<HTMLImageElement>('[data-neutral-portrait]');
const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');

if (stage && canvas && neutralImage && motionButton) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Fix the tier for this page visit; resize never retains a second decoded set.
  const tier: ResolutionTier = window.matchMedia('(min-width: 900px) and (pointer: fine) and (hover: hover)').matches ? 'large' : 'standard';
  const supplied = gazeFrames(tier);
  const neutral = supplied.find(frame => frame.x === 0 && frame.y === 0)!;
  const frames: PortraitFrame[] = [neutral];
  const images = new Map<string, HTMLImageElement>([[neutral.src, neutralImage]]);
  const halfBlink = assetUrl('blink-half', tier);
  const closedBlink = assetUrl('blink-closed', tier);
  let currentFrame = neutral;
  let visibleImage = neutralImage;
  let current: Point = { x: 0, y: 0 };
  let target: Point = { x: 0, y: 0 };
  let frameRequest = 0;
  let lastTime = 0;
  let activePointer: number | null = null;
  let paused = false;
  let inView = true;
  let focused = true;
  let blinkTimer = 0;
  let blinkStepTimer = 0;
  let blinking = false;
  const enabled = () => !paused && !reducedMotion.matches && !document.hidden && inView && focused;

  function showImage(src: string) {
    const next = images.get(src);
    if (!next || next === visibleImage) return;
    visibleImage.classList.remove('is-visible');
    next.classList.add('is-visible');
    visibleImage = next;
  }

  function cancelBlink() {
    window.clearTimeout(blinkTimer);
    window.clearTimeout(blinkStepTimer);
    blinkTimer = blinkStepTimer = 0;
    blinking = false;
    showImage(currentFrame.src);
  }

  function scheduleBlink() {
    if (!enabled() || blinkTimer || blinking || currentFrame !== neutral || !images.has(halfBlink) || !images.has(closedBlink)) return;
    const [min, max] = portraitConfig.blinkIntervalMs;
    blinkTimer = window.setTimeout(() => {
      blinkTimer = 0;
      if (!enabled() || currentFrame !== neutral) return;
      blinking = true;
      const sequence = [{ src: halfBlink, ms: 35 }, { src: closedBlink, ms: 70 }, { src: halfBlink, ms: 35 }];
      function advance(index: number) {
        if (!enabled() || currentFrame !== neutral) { cancelBlink(); return; }
        const step = sequence[index];
        if (!step) { blinking = false; blinkStepTimer = 0; showImage(neutral.src); scheduleBlink(); return; }
        showImage(step.src);
        blinkStepTimer = window.setTimeout(() => advance(index + 1), step.ms);
      }
      advance(0);
    }, min + Math.random() * (max - min));
  }

  function render() {
    const next = selectFrame(frames, current, currentFrame, portraitConfig.frameMargin);
    if (next !== currentFrame) {
      cancelBlink();
      currentFrame = next;
    }
    if (!blinking) showImage(currentFrame.src);
    scheduleBlink();
  }

  function tick(time: number) {
    frameRequest = 0;
    if (!enabled()) return;
    current = smoothPoint(current, target, lastTime ? Math.min(time - lastTime, 50) : 16, portraitConfig.smoothingMs);
    lastTime = time;
    if (Math.hypot(current.x - target.x, current.y - target.y) < 0.001) current = { ...target };
    render();
    if (current.x !== target.x || current.y !== target.y) frameRequest = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function schedule() {
    if (enabled() && !frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  function releasePointer() {
    const pointer = activePointer;
    activePointer = null;
    if (pointer !== null && stage!.hasPointerCapture(pointer)) stage!.releasePointerCapture(pointer);
  }

  function reset(immediate = false) {
    releasePointer();
    cancelBlink();
    target = { x: 0, y: 0 };
    if (immediate || !enabled()) {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      lastTime = 0;
      current = { ...target };
      currentFrame = neutral;
      showImage(neutral.src);
    } else schedule();
    canvas!.classList.toggle('is-animated', enabled());
    if (enabled()) { void loader.start(); scheduleBlink(); }
  }

  function update(event: PointerEvent) {
    if (!enabled()) return;
    // The canvas is always a 3:2 rectangle: no object-fit offsets to guess.
    const rect = canvas!.getBoundingClientRect();
    const eye = { x: rect.left + rect.width * portraitConfig.eyeAnchor.x, y: rect.top + rect.height * portraitConfig.eyeAnchor.y };
    target = normalizePointer(event.clientX, event.clientY, { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }, eye);
    schedule();
  }

  const isControl = (event: PointerEvent) => event.target instanceof Element && !!event.target.closest('a,button,input,select,textarea,[contenteditable="true"]');
  stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || !enabled() || isControl(event)) return;
    activePointer = event.pointerId;
    stage!.setPointerCapture(event.pointerId);
    update(event);
  });
  window.addEventListener('pointermove', (event) => {
    if (!event.isPrimary || isControl(event)) return;
    if (activePointer !== null ? event.pointerId === activePointer : event.pointerType === 'mouse') update(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    stage.addEventListener(type, (event) => { if (event.pointerId === activePointer) reset(); });
  }
  stage.addEventListener('pointerleave', () => { if (activePointer === null) reset(); });
  window.addEventListener('blur', () => { focused = false; reset(true); });
  window.addEventListener('focus', () => { focused = true; reset(true); });
  window.addEventListener('resize', () => reset(true));
  document.addEventListener('visibilitychange', () => reset(true));

  function updateButton() {
    motionButton!.disabled = reducedMotion.matches;
    motionButton!.textContent = reducedMotion.matches ? 'Motion off' : paused ? 'Resume motion' : 'Pause motion';
    motionButton!.setAttribute('aria-pressed', String(paused || reducedMotion.matches));
  }
  reducedMotion.addEventListener('change', () => { reset(true); updateButton(); });
  motionButton.addEventListener('click', () => { paused = !paused; reset(true); updateButton(); });
  motionButton.hidden = false;
  updateButton();

  // Decode the immediate neighbors before the outer ring. Keep the SSR image
  // usable during loading, including when the large neutral asset fails.
  const directional = supplied.filter(frame => frame !== neutral).sort((a, b) =>
    Math.max(Math.abs(a.x), Math.abs(a.y)) - Math.max(Math.abs(b.x), Math.abs(b.y)));
  const queue = [
    ...(tier === 'large' ? [{ src: neutral.src, frame: neutral }] : []),
    ...directional.slice(0, 8).map(frame => ({ src: frame.src, frame })),
    { src: halfBlink, frame: undefined }, { src: closedBlink, frame: undefined },
    ...directional.slice(8).map(frame => ({ src: frame.src, frame })),
  ];
  const loader = createDecodeQueue(queue, async ({ src, frame }) => {
    const image = new Image();
    image.src = src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.className = 'portrait-image';
    try {
      await image.decode();
      canvas!.append(image);
      images.set(src, image);
      if (frame && frame !== neutral) frames.push(frame);
      if (frame === neutral) {
        // Keep one accessible portrait; all other frames are decorative.
        image.alt = portraitConfig.alt;
        image.removeAttribute('aria-hidden');
        if (currentFrame === neutral && !blinking) showImage(src);
        neutralImage!.remove();
      }
      if (enabled()) { schedule(); scheduleBlink(); }
    } catch {
      console.warn(`Portrait frame unavailable: ${src}`);
    }
  }, enabled, portraitConfig.decodeConcurrency);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && inView !== entry.isIntersecting) { inView = entry.isIntersecting; reset(true); }
    });
    observer.observe(stage);
  }
  reset(true);
}
