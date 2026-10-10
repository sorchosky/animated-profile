import { portraitConfig, type PortraitFrame } from './config.ts';
import { normalizePointer, selectFrame, smoothPoint, type Point } from './motion.ts';

const stage = document.querySelector<HTMLElement>('[data-portrait-stage]');
const canvas = document.querySelector<HTMLElement>('[data-portrait-canvas]');
const neutralImage = document.querySelector<HTMLImageElement>('[data-neutral-portrait]');
const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');

if (stage && canvas && neutralImage && motionButton) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const neutral: PortraitFrame = { x: 0, y: 0, src: portraitConfig.neutral };
  let frames: PortraitFrame[] = [neutral];
  const images = new Map<string, HTMLImageElement>([[neutral.src, neutralImage]]);
  let currentFrame = neutral;
  let current: Point = { x: 0, y: 0 };
  let target: Point = { x: 0, y: 0 };
  let frameRequest = 0;
  let lastTime = 0;
  let activePointer: number | null = null;
  let paused = false;
  const enabled = () => !paused && !reducedMotion.matches && !document.hidden;

  function showFrame(frame: PortraitFrame) {
    if (currentFrame.src === frame.src) return;
    images.get(currentFrame.src)?.classList.remove('is-visible');
    images.get(frame.src)?.classList.add('is-visible');
    currentFrame = frame;
  }

  function render() {
    showFrame(selectFrame(frames, current, currentFrame));
    if (portraitConfig.placeholderTilt && frames.length === 1 && enabled()) {
      canvas!.style.transform = `scale(1.06) rotateX(${-current.y * 2}deg) rotateY(${current.x * 2.5}deg) rotateZ(${current.x * 1.8}deg)`;
    } else {
      canvas!.style.removeProperty('transform');
    }
  }

  function tick(time: number) {
    frameRequest = 0;
    current = smoothPoint(current, target, lastTime ? Math.min(time - lastTime, 50) : 16, portraitConfig.smoothingMs);
    lastTime = time;
    if (Math.hypot(current.x - target.x, current.y - target.y) < 0.001) current = { ...target };
    render();
    if (current.x !== target.x || current.y !== target.y) frameRequest = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  function releasePointer() {
    const pointer = activePointer;
    activePointer = null;
    if (pointer !== null && stage!.hasPointerCapture(pointer)) stage!.releasePointerCapture(pointer);
  }

  function reset(immediate = false) {
    releasePointer();
    target = { x: 0, y: 0 };
    if (immediate || !enabled()) {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      lastTime = 0;
      current = { ...target };
      showFrame(neutral);
      canvas!.style.removeProperty('transform');
    } else schedule();
  }

  function update(event: PointerEvent) {
    if (!enabled()) return;
    target = normalizePointer(event.clientX, event.clientY, stage!.getBoundingClientRect());
    schedule();
  }

  stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || !enabled()) return;
    activePointer = event.pointerId;
    stage!.setPointerCapture(event.pointerId);
    update(event);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!event.isPrimary) return;
    if (activePointer !== null ? event.pointerId === activePointer : event.pointerType === 'mouse') update(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    stage.addEventListener(type, (event) => {
      if (event.pointerId === activePointer) reset();
    });
  }
  stage.addEventListener('pointerleave', () => { if (activePointer === null) reset(); });
  window.addEventListener('blur', () => reset(true));
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

  // Decode before displaying; missing directional files leave the neutral portrait usable.
  void Promise.all(portraitConfig.frames.filter(frame => frame.src !== neutral.src).map(async frame => {
    const image = new Image();
    image.src = frame.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.className = 'portrait-image';
    try {
      await image.decode();
      return { frame, image };
    } catch {
      console.warn(`Portrait frame unavailable: ${frame.src}`);
      return null;
    }
  })).then(loaded => {
    for (const entry of loaded) {
      if (!entry) continue;
      if (!images.has(entry.frame.src)) {
        canvas!.append(entry.image);
        images.set(entry.frame.src, entry.image);
      }
      frames.push(entry.frame);
    }
    if (enabled()) schedule();
  });
}
