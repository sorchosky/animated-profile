import type { PortraitFrame } from './config.ts';

export interface Point { x: number; y: number }
export interface Bounds { left: number; top: number; width: number; height: number }

export const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value));

export function normalizePointer(clientX: number, clientY: number, bounds: Bounds): Point {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((clientX - bounds.left) / bounds.width) * 2 - 1),
    y: clamp(((clientY - bounds.top) / bounds.height) * 2 - 1),
  };
}

/** Time-based damping gives the same response on 60 Hz and 120 Hz displays. */
export function smoothPoint(current: Point, target: Point, elapsedMs: number, smoothingMs: number): Point {
  const blend = smoothingMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, elapsedMs) / smoothingMs);
  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
  };
}

/** A small margin prevents flicker along the boundary between two portraits. */
export function selectFrame(frames: readonly PortraitFrame[], point: Point, current?: PortraitFrame): PortraitFrame {
  if (!frames.length) throw new Error('At least the neutral portrait is required.');
  const distance = (frame: PortraitFrame) => (frame.x - point.x) ** 2 + (frame.y - point.y) ** 2;
  const nearest = frames.reduce((best, frame) => distance(frame) < distance(best) ? frame : best);
  if (current && frames.includes(current) && distance(current) <= distance(nearest) + 0.08) return current;
  return nearest;
}
