export interface PortraitFrame {
  /** Screen direction: -1 left/up, 0 center, 1 right/down. */
  x: number;
  y: number;
  src: string;
}

export const portraitConfig = {
  neutral: '/portraits/neutral.jpeg',
  alt: 'Stylized portrait of Steve Orchosky wearing glasses and a navy jacket.',
  width: 1536,
  height: 1024,
  background: '#626034',
  objectPosition: '50% 50%',
  /** Add directional images here; neutral is always included automatically. */
  frames: [] as PortraitFrame[],
  /** Temporary whole-image tilt, disabled once directional frames are ready. */
  placeholderTilt: true,
  smoothingMs: 110,
};
