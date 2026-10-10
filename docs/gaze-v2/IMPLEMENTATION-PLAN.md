# Denser gaze assets for animated-profile

Target: https://github.com/sorchosky/animated-profile

## Recommendation

Use 25 gaze poses in a 5 × 5 grid, plus 2 neutral-only blink states (27 unique assets). The axis samples are -1, -0.5, 0, 0.5, 1 in viewer coordinates; negative y is up. This adds 16 intermediate poses to the original 9, halves the coordinate spacing in both axes, and keeps selection inexpensive. This is an engineering recommendation, not a measured optimum. Benchmark in the real hero before expanding to 49 poses. More independently generated images can increase flicker; they do not create true continuous rotation.

All masters are 1536 × 1024. The standard web set is 768 × 512; the large set is 1152 × 768. Use the standard set on constrained devices and the large set for a larger desktop hero. Effective sharpness depends on the subject's occupied area, not only canvas dimensions. 27 decoded standard frames cost about 40.5 MiB; large frames about 91.1 MiB; native frames about 162 MiB. These numbers omit DOM, GPU, and browser copies. Do not serve the PNG masters or one huge native atlas as the default.

## Repository evidence

Read default-branch package.json, README.md, src/portrait/config.ts, src/portrait/motion.ts and src/portrait/controller.ts on 2026-10-10. It uses Astro with TypeScript and native Pointer Events. The default branch still configures a placeholder neutral JPEG with no directional frames. An unmerged branch or hosted preview may have newer work: inspect it before applying this handoff. No repository writes were performed by this asset task.

The existing selector already chooses the nearest supplied (x,y) coordinate. Keep this stack; no React or 3D library is needed for raster pose selection. Its current squared-distance hysteresis of 0.08 is large relative to the new 0.5 sample spacing. Start at 0.02, expose it as a config value, and test slow boundary crossings. Do not blindly replace existing tests or unmerged asset integration.

## Ordered implementation

1. Create a feature branch from the actual integration branch. Copy public/portraits/gaze-v2 from this pack into the repository. Copy manifest.json and QA-REPORT.md into docs/gaze-v2. Keep masters out of the web build; archive them separately. Verify all URLs and file hashes before committing.
2. Update src/portrait/config.ts using snippets/frames.ts. Neutral is separate; the frames array contains 24 non-neutral entries. Disable placeholderTilt. Keep the static background on its own element; never rotate or scale it with the character. Preserve whichever supplied background the current implementation already uses. This pack does not replace the background.
3. Keep every portrait in one identical drawn rectangle with a fixed bottom-center anchor. Account for object-fit crop offsets when locating the eye anchor. Start with normalized anchor (0.473, 0.291), inherited from the first handoff, and verify visually in the actual neutral render. Map pointer offsets from that anchor to each viewport edge, clamping both axes to [-1,1]. The current motion.ts maps around the stage center, which is a different behavior.
4. Retain time-based damping around 90–110 ms. Reduce the nearest-frame squared-distance margin to 0.02 as a starting point; validate it at 60 and 120 Hz. Change pixels only when the selected decoded frame changes. Do not crossfade pupils/glasses or interpolate sprites with opacity. Denser sampling changes pose spacing, not the rendering frame rate.
5. Show neutral immediately. Load the 8 immediate neighbors first, then the outer ring with bounded decode concurrency (2–4). Activate only decoded frames and retain the previous valid frame on failures. Avoid firing 24 full-size decodes simultaneously on mobile. Choose one resolution tier at startup; resizing must not retain two complete decoded sets indefinitely. Add an explicit reset when changing tiers.
6. Preserve touch/pen primary-drag tracking and pointer capture. On release/cancel return to neutral. Keep links, buttons and page scrolling usable; capture only within the intended interaction surface, excluding controls. Keep ambient breathing optional and extremely subtle. Blink only in neutral with 35 ms half / 70 ms closed / 35 ms half; never jump a directional head into neutral just to blink. The original blink assets have lighting variation and remain subject to the QA gate.
7. Retain the accessible pause control, live reduced-motion handling, no-JS neutral fallback, visibility/blur/resize resets, and stopping requestAnimationFrame after settling. Reduced motion means static neutral, including no blink or breathing.
8. Complete the visual QA gate below before deployment. Commit the asset integration and controller tuning separately where practical. Open a PR with the 5 × 5 review image, measured byte sizes, memory tier, checks run, and remaining visual limitations. Do not claim these generated views are a rig or guaranteed continuous motion.

## QA release gate

Read QA-REPORT.md and qa-metrics.json. Generated frames are candidates, not certified renders of one fixed-light scene. The original set fails a strict continuity guarantee. Passing dimensions/alpha and average-color checks is not sufficient to certify face lighting. Do not mark the production lighting issue resolved solely because 25 coordinates exist.

Review every horizontal, vertical, and diagonal neighboring pair at the final display size on the real background, plus black and white. Check face exposure, warm rim intensity, catchlights, glasses shape, hair silhouette, jacket tone, shoulder anchoring, edge halos, and monotonic gaze. Slow and fast sweeps should not flash the body or double pupils. A static-body / animated-head composition can reduce clothing flicker, but requires an artist-reviewed neck seam and must not be silently introduced as a finished fix.

If any frame visibly flashes, replace/retouch that frame with neutral as the fixed lighting reference. Do not hide it with a long crossfade or an arbitrary whole-image brightness filter; those alter face shading and can introduce new artifacts. If the required bar is literally guaranteed identical scene lighting, obtain a matching rigged character and render all 25 views with a fixed camera, environment, materials, exposure and light transforms. That is the reliable production path.

## Validation

Run the repository's npm run check, npm test, and npm run build. Add meaningful selector tests for half-step coordinates, boundary jitter, neutral resets, missing assets, and frame availability. In-browser: check fine-pointer tracking, iPad primary dragging, normal scrolling and controls, no-JS fallback, live reduced-motion, pause, background-tab behavior, slow network, one failed frame, and resize. Inspect at desktop DPR 1/2 and a representative iPad/mobile size. Measure startup transfer, decode time, peak memory and response latency in the actual layout; the asset generation task does not test the website end-to-end.

## Delivery contract

manifest.json is authoritative for coordinates, provenance, filenames, sizes and hashes. review.html is an offline visual review tool; it is not the portfolio page. generation-prompts.json records built-in image-generation prompts. Packaging uses image conversion only; it does not synthesize intermediate faces with a pixel warp. 16 new independent intermediate sprites are included alongside the original 11 frames.
