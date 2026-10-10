# QA report: 25 gaze poses + 2 blink states

**Result: dimensions and alpha passed; strict lighting continuity did not pass.** No frame is certified to have identical lighting. All 16 requested intermediate assets were generated separately from the same neutral reference using built-in image generation. The original 11 are preserved, not silently relit.

## Method and limits

Inspected the original contact sheet and native neutral, then the generated images and combined review grid. Measured three fixed opaque clothing patches in all 27 masters. Left-jacket luma uses 0.2126R + 0.7152G + 0.0722B on sRGB averages; this is a screening proxy, not a physical lighting measurement. Differences combine lighting, fabric detail and geometry changes. A ±5% trigger flags visual review; passing does not guarantee face-lighting continuity. Measurements are in qa-metrics.json.

Original clothing colors are not stable against neutral. Upper-left is the largest measured jacket deviation. Downward poses also change head/neck and hair silhouette. All original canvases are RGBA at 1536 × 1024 with real zero-alpha pixels, but that alone cannot certify edge quality. The warm rim treatment is intentional; changes in its intensity between frames remain a concern.

## Per-frame screening

| Asset | Provenance / original name | Jacket luma vs neutral | Screening |
| --- | --- | ---: | --- |
| gaze-r0-c0 | look-up-left | +21.32% | flag |
| gaze-r0-c1 | new-intermediate | +12.44% | flag |
| gaze-r0-c2 | look-up | +10.42% | flag |
| gaze-r0-c3 | new-intermediate | +9.24% | flag |
| gaze-r0-c4 | look-up-right | +8.71% | flag |
| gaze-r1-c0 | new-intermediate | +8.85% | flag |
| gaze-r1-c1 | new-intermediate | +8.06% | flag |
| gaze-r1-c2 | new-intermediate | +8.29% | flag |
| gaze-r1-c3 | new-intermediate | +8.41% | flag |
| gaze-r1-c4 | new-intermediate | +8.75% | flag |
| gaze-r2-c0 | look-left | +14.65% | flag |
| gaze-r2-c1 | new-intermediate | +12.32% | flag |
| gaze-r2-c2 | neutral | +0.00% | within-proxy-tolerance |
| gaze-r2-c3 | new-intermediate | +11.69% | flag |
| gaze-r2-c4 | look-right | +13.94% | flag |
| gaze-r3-c0 | new-intermediate | +7.18% | flag |
| gaze-r3-c1 | new-intermediate | +9.69% | flag |
| gaze-r3-c2 | new-intermediate | +8.29% | flag |
| gaze-r3-c3 | new-intermediate | +23.17% | flag |
| gaze-r3-c4 | new-intermediate | +7.25% | flag |
| gaze-r4-c0 | look-down-left | +11.64% | flag |
| gaze-r4-c1 | new-intermediate | +10.84% | flag |
| gaze-r4-c2 | look-down | +18.57% | flag |
| gaze-r4-c3 | new-intermediate | +20.60% | flag |
| gaze-r4-c4 | look-down-right | +15.28% | flag |
| blink-half | original-blink | +7.57% | flag |
| blink-closed | original-blink | +8.97% | flag |

## Required release checks

Use review.html and the actual hero. Inspect every neighboring pair for exposure flash, facial shading, pupil direction, rim-light intensity, glasses/hair morphing and shoulder movement. Check black/white/green backgrounds and full-size cropping. Re-render or artist-retouch failures; do not describe them as guaranteed consistent. A locked 3D scene is required for a literal scene-lighting guarantee. The website itself was not executed or changed in this task.

The additional frames reduce coordinate spacing, but independent generation can still produce nonuniform pose spacing. The x/y values are intended gaze targets, not measured 3D angles. Treat the contact sheet as the map and validate monotonic movement in context.

## Direction corrections and visible residuals

Replaced the first candidates at (+0.5,+0.5) and (+0.5,+1) after their pupils aimed too high or left. The selected replacements aim down-right, but their jacket screening values are +23.17% and +20.60% against original neutral. These are explicit unresolved lighting/color flags. The new intermediate head rotations also do not always sit at exact geometric midpoints between old extremes; the lower-right corner has a particularly visible head/hair change. Do not treat the nominal coordinate grid as a measured, uniformly spaced rig.
