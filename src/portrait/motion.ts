import type { PortraitFrame } from './config.ts';

export interface Point { x: number; y: number }
export interface Bounds { left: number; top: number; width: number; height: number }

export const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value));

export function normalizePointer(clientX: number, clientY: number, bounds: Bounds, eye?: Point): Point {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  const anchor = eye ?? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  const dx = clientX - anchor.x;
  const dy = clientY - anchor.y;
  return {
    x: clamp(dx / Math.max(1, dx < 0 ? anchor.x - bounds.left : bounds.left + bounds.width - anchor.x)),
    y: clamp(dy / Math.max(1, dy < 0 ? anchor.y - bounds.top : bounds.top + bounds.height - anchor.y)),
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

export const poseDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** A small linear margin prevents flicker along the boundary between two portraits. */
export function selectFrame(frames: readonly PortraitFrame[], point: Point, current?: PortraitFrame, margin = 0.015): PortraitFrame {
  if (!frames.length) throw new Error('At least the neutral portrait is required.');
  const distance = (frame: PortraitFrame) => poseDistance(frame, point);
  const nearest = frames.reduce((best, frame) => distance(frame) < distance(best) ? frame : best);
  if (current && frames.includes(current) && distance(current) <= distance(nearest) + margin) return current;
  return nearest;
}

/** Neighboring frames cut; long jumps across the unsampled interior crossfade for a duration that scales with distance. */
export function crossfadeDuration(from: Point, to: Point, threshold: number, [min, max]: readonly [number, number]): number {
  const distance = poseDistance(from, to);
  return distance <= threshold ? 0 : Math.round(Math.min(max, Math.max(min, distance * max)));
}
