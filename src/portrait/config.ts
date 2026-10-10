export interface PortraitFrame {
  /** Viewer coordinates, sampled every 0.5. Never mirror the artwork. */
  x: number;
  y: number;
  src: string;
}

export type ResolutionTier = 'standard' | 'large';
export const assetUrl = (name: string, tier: ResolutionTier = 'standard') => `/portraits/gaze-v2/${tier}/${name}.webp`;

export function gazeFrames(tier: ResolutionTier): PortraitFrame[] {
  return [-1, -0.5, 0, 0.5, 1].flatMap((y, row) =>
    [-1, -0.5, 0, 0.5, 1].map((x, column) => ({ x, y, src: assetUrl(`gaze-r${row}-c${column}`, tier) }))
  );
}

export const portraitConfig = {
  neutral: assetUrl('gaze-r2-c2'),
  alt: 'Stylized portrait of Steve Orchosky wearing glasses and a navy jacket.',
  width: 1536,
  height: 1024,
  background: '#626034',
  backgroundImage: '/portraits/background.webp',
  eyeAnchor: { x: 0.473, y: 0.291 },
  smoothingMs: 100,
  frameMargin: 0.02,
  decodeConcurrency: 3,
  blinkIntervalMs: [3500, 7000] as const,
};
