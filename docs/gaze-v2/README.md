# Gaze v2 provenance and integration

The implementation plan and QA report in this directory were produced during asset generation, before this PR. Statements in those source documents about no repository changes refer to that earlier asset-only task. The current integration is described in the repository README.

The manifest lists both archival PNG masters (kept in the delivered ZIP) and the two WebP tiers shipped in public/portraits/gaze-v2. The coordinates are intended targets, not measured 3D angles. The original lighting warnings remain unresolved; no whole-image brightness filters or long crossfades were applied to conceal them.

The old placeholder has been replaced by the transparent neutral pose. The supplied olive background is independently converted to public/portraits/background.webp and stays stationary.
