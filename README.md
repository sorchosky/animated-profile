# Animated profile

A single, full-viewport portrait of Steve against an olive-green background. Built with Astro, TypeScript, and CSS; the page is statically rendered and the interaction uses native Pointer Events and requestAnimationFrame. No backend, React runtime, or animation library is needed.

## Run

Use Node 24 (minimum 22.12).

```sh
npm ci
npm run dev
```

Validation and static output:

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` can be deployed to any static host. `.openai/hosting.json` identifies the private hosted preview. The GitHub workflow runs type checks, motion tests, and a production build; it does not deploy or merge the PR.

## Interaction

- Mouse movement maps to screen directions. Touch and pen follow a primary drag with pointer capture, then ease back to neutral on release or cancellation.
- Leaving the page, resizing, losing focus, or pausing returns the portrait to neutral.
- The motion loop stops when the pose settles. Reduced-motion preferences keep a static neutral portrait; the accessible pause control is usable with the keyboard.
- Without JavaScript, the portrait still renders. Missing directional assets fall back to available decoded portraits.

The supplied JPEG is a **temporary composite**: its background and shoulders move with its gentle CSS tilt. True directional head movement starts when directional portraits are added. No head isolation or new image assets have been generated.

## Add directional portraits

Place the files in `public/portraits/`, then edit `src/portrait/config.ts`. URLs omit `public/`. Direction coordinates describe **the position of the visitor's cursor on the screen**, not the character's anatomical left and right.

Recommended first set: neutral plus eight surrounding poses. These names are a suggested contract; actual filenames are configured in one place.

| Filename | Cursor direction | x | y |
| --- | --- | --- | --- |
| neutral.jpeg | Center | 0 | 0 |
| up-left.webp | Upper left | -1 | -1 |
| up.webp | Up | 0 | -1 |
| up-right.webp | Upper right | 1 | -1 |
| left.webp | Left | -1 | 0 |
| right.webp | Right | 1 | 0 |
| down-left.webp | Lower left | -1 | 1 |
| down.webp | Down | 0 | 1 |
| down-right.webp | Lower right | 1 | 1 |

Example configuration:

```ts
frames: [
  { x: -1, y: -1, src: '/portraits/up-left.webp' },
  { x: 0, y: -1, src: '/portraits/up.webp' },
  { x: 1, y: -1, src: '/portraits/up-right.webp' },
  { x: -1, y: 0, src: '/portraits/left.webp' },
  { x: 1, y: 0, src: '/portraits/right.webp' },
  { x: -1, y: 1, src: '/portraits/down-left.webp' },
  { x: 0, y: 1, src: '/portraits/down.webp' },
  { x: 1, y: 1, src: '/portraits/down-right.webp' },
],
```

Neutral is automatically included. All frames decode before the directional set becomes active, and composite tilt is automatically disabled as soon as a directional frame is available. Frame selection uses the nearest supplied direction with a small boundary margin to avoid flicker. More intermediate directions can be added without changing the controller. This is discrete pose selection; it does not morph faces or synthesize missing poses.

For clean swaps, export the same canvas size, framing, background, lighting, and shoulder alignment across all images. Keep the head in the same region and leave enough room around the hair for mobile cropping. JPEG/WebP full portraits work; transparent full portraits can also reveal the configured green background. Keep assets compressed: all directional frames are decoded for seamless swaps, so unusually large sets increase memory use.

The placeholder is 1536 × 1024. Update `width`, `height`, `objectPosition`, and `background` when final assets arrive. `object-fit: cover` fills the viewport and crops the sides on narrow phones; the centered face is prioritized.

## Scope

This scaffold contains the portrait interaction only. Portfolio copy, navigation, projects, analytics, and contact links can be added when their requirements are supplied.
