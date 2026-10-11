import capture from './frames.json' with { type: 'json' };

export interface PortraitFrame {
  /** Viewer coordinates measured from the head pose in each video frame. Never mirror the artwork. */
  x: number;
  y: number;
  src: string;
}

export type ResolutionTier = 'standard' | 'large';
// Served frames are alpha cutouts of the gaze-video stills (scripts/cutout_frames.py), so page layers can sit behind the figure.
export const assetUrl = (name: string, tier: ResolutionTier = 'standard') => `/portraits/cutout/${tier}/${name}.webp`;

/** Frames arrive in load order: neutral first, then coarse-to-fine coverage of the pose range. */
export function gazeFrames(tier: ResolutionTier): PortraitFrame[] {
  return capture.frames.map(({ name, x, y }) => ({ x, y, src: assetUrl(name, tier) }));
}

export const portraitConfig = {
  neutralName: capture.neutral,
  neutral: assetUrl(capture.neutral),
  alt: 'Stylized portrait of Steve Orchosky wearing glasses and a navy jacket.',
  width: capture.width,
  height: capture.height,
  background: '#4a4220',
  eyeAnchor: capture.eyeAnchor,
  smoothingMs: 120,
  /** Linear pose distance a new frame must win by before it replaces the current one. */
  frameMargin: 0.015,
  /** Jumps longer than this (neutral to a full turn) crossfade instead of cutting. */
  crossfadeDistance: 0.15,
  crossfadeMs: [70, 150] as const,
  /** Frames decoded before the blink pair: enough for coarse coverage of every direction. */
  coarseFrameCount: 16,
  decodeConcurrency: 4,
  blinkIntervalMs: [3500, 7000] as const,
};
