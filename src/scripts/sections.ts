// Tracks which full-page panel is on screen: marks its indicator dot current and
// lets that panel's animation run.
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
const dots = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('[data-section-dot]')].map(dot => [dot.hash.slice(1), dot]),
);

function setCurrent(panel: HTMLElement) {
  for (const other of panels) other.classList.toggle('is-current', other === panel);
  for (const [id, dot] of dots) dot.setAttribute('aria-current', String(id === panel.id));
}

// CSS snapping settles a short wheel nudge back onto the same panel. Turn each wheel
// gesture into exactly one page step instead. Touch, keyboard and the scrollbar keep
// native snapping. The step stays locked until the scroll lands and the wheel has been
// quiet for a moment, so trackpad inertia can't skip panels.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const quietMs = 160;
let locked = false;
let landed = true;
let lastWheel = 0;
let unlockTimer = 0;

function tryUnlock() {
  window.clearTimeout(unlockTimer);
  const wait = quietMs - (performance.now() - lastWheel);
  if (landed && wait <= 0) locked = false;
  else unlockTimer = window.setTimeout(tryUnlock, landed ? wait : 100);
}

window.addEventListener('wheel', (event) => {
  // Pinch-zoom arrives as ctrl+wheel; horizontal gestures aren't page steps.
  if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
  event.preventDefault();
  lastWheel = performance.now();
  if (locked || Math.abs(event.deltaY) < 4) return;
  const index = Math.round(window.scrollY / window.innerHeight);
  const next = panels[Math.min(Math.max(index + Math.sign(event.deltaY), 0), panels.length - 1)];
  if (!next || next === panels[index]) return;
  locked = true;
  landed = false;
  next.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  // scrollend isn't in every browser yet; the timeout covers it. Each step clears its
  // own fallback so a stale timer can't land a later step early.
  const fallback = window.setTimeout(() => land(), 900);
  const land = () => {
    window.clearTimeout(fallback);
    window.removeEventListener('scrollend', land);
    landed = true;
    tryUnlock();
  };
  window.addEventListener('scrollend', land);
}, { passive: false });

if (panels.length && 'IntersectionObserver' in window) {
  // A panel counts as current once it fills most of the viewport, which happens
  // exactly once per snap.
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target as HTMLElement);
  }, { threshold: 0.6 });
  for (const panel of panels) observer.observe(panel);
}
