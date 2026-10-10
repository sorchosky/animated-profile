# Animated profile

Steve's 25-pose transparent portrait over a static olive studio background. Built with Astro, TypeScript, native Pointer Events and requestAnimationFrame. No backend or animation runtime is required.

## Run and validate

Use Node 24 (minimum 22.12).

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

`dist/` deploys to any static host. The existing `.openai/hosting.json` retains the hosted Site identity. The GitHub workflow runs checks, tests and a production build; opening or merging a PR does not itself publish a hosted preview.

## Interaction

- Mouse position maps from the portrait's eye anchor toward each viewport edge. The 5 × 5 grid samples each axis at -1, -0.5, 0, 0.5 and 1 in viewer coordinates; images are never mirrored.
- Targets ease over 100 ms. Nearest-pose selection uses a 0.02 squared-distance margin to prevent boundary chatter. There are no crossfades or synthesized facial morphs.
- Primary touch and pen drags use pointer capture. Release/cancellation settles back to neutral. Native vertical scrolling and pinch zoom take precedence when the browser claims the gesture. Controls are excluded from capture.
- Neutral-only blinking uses half / closed / half at 35 / 70 / 35 ms, with randomized 3.5–7 second pauses. Moving into a directional pose cancels the blink. The foreground has a restrained 5-second breathing cycle; the background stays still.
- Pause, reduced motion, hidden/offscreen pages and window blur stop animation. Reduced motion is observed live. Without JavaScript, the transparent neutral and background still render.
- Leaving the portrait, resizing or ending a drag resets the target. There is no placeholder CSS head tilt.

## Assets and loading

`public/portraits/gaze-v2/` contains 27 WebP images in each tier (25 gaze poses and two neutral blink states):

| Tier | Dimensions | Total WebP bytes | Approx. decoded RGBA memory |
| --- | --- | ---: | ---: |
| standard | 768 × 512 | 1,680,192 | 40.5 MiB |
| large | 1152 × 768 | 3,234,102 | 91.1 MiB |

Fine-pointer, hover-capable screens at least 900 CSS pixels wide choose large; other devices use standard. The tier stays fixed for the page visit so resizing does not retain duplicate decoded sets. The standard neutral is the immediate HTML fallback; large neutral replaces it only after decoding succeeds.

At most three assets decode concurrently. The eight immediate neighbors precede the outer ring. A failed image never enters selection, and pause/reduced motion prevents additional queued work from starting. Decodes already in flight may finish. RequestAnimationFrame stops once the pointer target settles.

The PNG masters remain in the delivered asset archive and are intentionally excluded from this repository and the web build. `docs/gaze-v2/manifest.json` records their provenance and hashes, plus every shipped WebP URL and hash. `src/portrait/config.ts` derives the coordinate grid from stable row/column filenames. `public/portraits/background.webp` is the supplied olive background, independently compressed and held static.

## Visual QA status

**Lighting consistency is still unresolved.** The generated images are review candidates, not frames rendered from one fixed 3D scene. The original set and intermediate poses have jacket/lighting differences and uneven geometric pose spacing. The two corrected down-right candidates also retain color differences. This integration does not retouch, normalize, or certify their lighting.

See [the QA report](docs/gaze-v2/QA-REPORT.md), [frame grid](docs/gaze-v2/review-grid.jpg), and [asset handoff](docs/gaze-v2/IMPLEMENTATION-PLAN.md). Review slow neighboring-pose transitions at the actual hero size before approving visual polish. A fixed-camera, fixed-light 3D rig is the reliable route to guaranteed scene-lighting consistency and continuous movement.

Automated coverage checks half-step selection, eye-relative mapping, damping, loading concurrency/resume/failure, controller pause/reduced-motion/blink/touch lifecycles, and all shipped asset hashes. Controller lifecycle tests use a simulated DOM and clock; they do not replace real browser/device visual QA.

## Scope

This page is the portrait interaction. Portfolio copy, project content, navigation and contact links remain separate work.
