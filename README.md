# Animated profile

Steve's cursor-tracking portrait, built from 78 stills extracted from one locked-off gaze video. Built with Astro, TypeScript, native Pointer Events and requestAnimationFrame. No backend or animation runtime is required.

## Run and validate

Use Node 24 (minimum 22.12).

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

`dist/` deploys to any static host. The existing `.openai/hosting.json` retains the hosted Site identity. The GitHub workflow runs checks, tests and a production build; opening or merging a PR does not itself publis## Interaction

- Mouse position maps from the portrait's eye anchor toward each viewport edge, in viewer coordinates from -1 to 1. Images are never mirrored.
- Each still carries the head pose measured from its video frame. A full head turn sits at radius 0.85, so the head turns before the cursor reaches the edge.
- Targets ease over 120 ms, and the nearest frame is drawn on every animation frame. A new frame must be at least 0.015 closer than the current one, which stops boundary chatter without lagging more than one step behind.
- Neighboring frames cut. A jump longer than 0.15 (neutral to a full turn, where the video has no in-between frames) crossfades for 70–150 ms, scaled by distance. The outgoing frame fades on top of the incoming one, so the opaque frames never show the page through.
- Primary touch and pen drags use pointer capture. Release or cancellation settles back to neutral. Native vertical scrolling and pinch zoom take precedence when the browser claims the gesture. Controls are excluded from capture.
- Neutral-only blinking uses half / closed / half at 35 / 70 / 35 ms, with randomized 3.5–7 second pauses. Moving into a directional pose cancels the blink. The foreground has a restrained 5-second breathing cycle, and the page backdrop stays still.
- Pause, reduced motion, hidden or offscreen pages and window blur stop animation. Reduced motion is observed live. Without JavaScript, the neutral still renders.
- Leaving the portrait, resizing or ending a drag resets the target.

## Source video and extraction

`scripts/extract_gaze_frames.py` rebuilds every asset from the source clip (a 10 s, 24 fps, 1152 × 768 locked-off shot that sweeps the head around a full loop and back to neutral):

1. MediaPipe Face Landmarker measures head yaw and pitch on all 243 frames. A three-frame median removes detector jitter.
2. Frames with a mean eye-blink score above 0.35 are dropped (16 frames across three blinks).
3. Poses are normalized per half-axis, since the sweep travels further down than up.
4. A frame is kept only when it is at least 0.05 from every kept frame, so neighbors differ by about 1.5° of head turn. Static holds collapse to one frame.
5. Frames are ordered farthest-point first. The first 16 loads cover every direction coarsely and later loads fill the gaps.
6. The blink pair comes from video frames 14 and 16. Their eye region is aligned to the neutral frame with a landmark similarity transform and feather-blended, which removes the small head dip the video has during its blink.

```sh
pip install mediapipe opencv-python-headless numpy pillow   # plus ffmpeg on PATH
python scripts/extract_gaze_frames.py gaze-sweep.mp4 face_landmarker.task
```

The script writes `public/portraits/gaze-video/`, `src/portrait/frames.json` (coordinates in load order plus the eye anchor) and `docs/gaze-video/` (`manifest.json` with settings, hashes and blink provenance, and `poses.json` with every frame's measured pose). The source clip and model are not committed.

## Assets and loading

| Tier | Dimensions | Files | Total WebP bytes | Approx. decoded RGBA memory |
| --- | --- | ---: | ---: | ---: |
| standard | 768 × 512 | 80 | ~1.3 MB | 120 MiB |
| large | 1152 × 768 (source resolution) | 80 | ~2.1 MB | 270 MiB |

Fine-pointer, hover-capable screens at least 900 CSS pixels wide get large. Other devices get standard. The tier stays fixed for the page visit. The standard neutral is the immediate HTML fallback. The large neutral replaces it only after decoding succeeds.

At most four assets decode at once. A failed image never enters selection, and pause or reduced motion stops queued work from starting. RequestAnimationFrame stops once the pointer target settles.

The page serves alpha cutouts from `public/portraits/cutout/`, so the masthead can sit between the backdrop and the figure. `scripts/cutout_frames.py` builds them from the opaque large-tier stills in `public/portraits/gaze-video/large` with rembg's `isnet-general-use` model, downscales the same matte for the standard tier, and records sizes and hashes in `docs/cutout/manifest.json`. Rerun it whenever the gaze frames are re-extracted:

```sh
pip install "rembg[cpu]" pillow
python scripts/cutout_frames.py
```

## Page layout

The home page is a deck of full-viewport panels: the hero, then one splash per project.

- `src/styles/tokens.css` holds the primitives and semantic roles. `--color-text` (cream drawn from the T-shirt) is the type token used across the olive surfaces. `--color-action-primary` is burnt sienna.
- The hero layers vignette backdrop, the `Steve Orchosky` masthead, the portrait, then the tagline and actions. The masthead (DM Serif Display) pins near the top and is fitted to the viewport width through `--masthead-em`, or `--masthead-em-stacked` when it breaks onto two lines below 768 px. `--figure-h` is solved from the masthead's bottom edge, so the hair only grazes the baseline (`--figure-overlap`). Copy is left-aligned at every size. Mobile centers the figure with the copy over a bottom scrim. From 768 px the figure moves to `--figure-x: 64%` and the copy locks up under the masthead in the left column.
- Type is self-hosted through Fontsource: DM Serif Display for display, Geist for UI and body. The masthead face is preloaded.
- Root `scroll-snap-type: y mandatory` handles touch, keyboard and scrollbar. `src/scripts/sections.ts` turns each wheel gesture into one panel step (locked through trackpad inertia), updates the section dots, runs only the current panel's animation and reveals its copy on arrival.
- Project copy lives in `src/content/projects.ts`. Subheads are drafts and every `[TK]` is a number to replace. `src/components/ProjectVisual.astro` holds placeholder SVG motion studies, and `/work/<slug>/` pages are stubs. `/resume.pdf` is linked but not yet committed.

## Known limits

- **The interior is sparsely sampled.** The video sweeps a ring of full turns plus neutral. The only in-between frames are on the down-left return path. Cursor positions between the face and a full turn crossfade between neutral and the ring instead of turning gradually. Closing this gap needs a second clip with slow half-turns from neutral.
- The down-right to down stretch (frames 171–177) loses six frames to a blink, so that arc steps more coarsely.
- Head pose drives the mapping. Eye-only motion during held head poses (frames 150–169) collapses to one frame.

Automated coverage checks eye-relative mapping, damping, dense-frame hysteresis, crossfade timing, ring coverage, loading concurrency, resume and failure, controller pause, reduced motion, blink and touch lifecycles, and all shipped asset hashes. Controller tests use a simulated DOM and clock. They don't replace real browser and device QA.
