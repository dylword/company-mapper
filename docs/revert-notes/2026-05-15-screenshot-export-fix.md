# 2026-05-15 — Screenshot export: crash fix + quality controls

## What changed
- Hardened the PNG screenshot exporter so it no longer crashes Chrome on large graphs and produces sharp output.
- Added a quality picker (1×/2×/4×) and a "Capture visible area only" toggle to the Export menu.

## Why
- User report: screenshot export crashed Chrome on a work laptop with a fair number of nodes on screen.
- On a more powerful laptop the export succeeded but the resulting PNG was very low quality.

Root causes in the previous `downloadImage`:
1. Output dimensions were set to the raw bounds of every node (`bounds + 100`). For sprawling graphs this could exceed Chrome's ~16,384px canvas limit and the ~256 MB texture budget, killing the tab on lower-spec machines.
2. `getTransformForBounds(..., 0.5, 2)` allowed the DOM to be CSS-scaled DOWN before rasterisation, which is the main cause of fuzzy text/borders.
3. No `pixelRatio` was set; on a non-retina display this produced 1× output of an already-shrunk DOM.

## Files touched
- [src/components/GraphCanvas.tsx](../../src/components/GraphCanvas.tsx) — rewrote `downloadImage` to accept `{ scale, fitVisible }`, cap output to `MAX_SCREENSHOT_DIMENSION = 12000`, downscale the DOM only if natural bounds exceed the cap, and pass `pixelRatio` explicitly.
- [src/components/canvas/ExportMenu.tsx](../../src/components/canvas/ExportMenu.tsx) — added scale (1×/2×/4×) buttons, "Capture visible area only" checkbox, and an explicit "Download PNG" button. Widened popover to `w-[260px]`.

## Behaviour
- Default: 2×, full-graph mode (same intent as before, just safer + sharper).
- Full-graph mode: if `max(width, height) * pixelRatio > 12000`, `pixelRatio` is reduced. If natural bounds alone exceed 12000, the DOM itself is uniformly scaled down via CSS transform before rasterising. Either way, the output PNG is guaranteed ≤ 12000 px on the long side.
- "Capture visible area only" mode: rasterises the `.react-flow` container at the current zoom, filtering out React Flow's controls/panels/minimap. Output is bounded by the viewport pixel size, so it never crashes regardless of graph size.

## How to revert
```bash
git revert <commit-sha>
```
Or manually:
- Restore `downloadImage` in `GraphCanvas.tsx` to the pre-change body (no options arg, `getTransformForBounds(..., 0.5, 2)`, no `pixelRatio`, no `MAX_SCREENSHOT_DIMENSION`).
- Restore `ExportMenu.tsx` to the simple "Download screenshot" row variant (`w-[220px]` popover, no scale buttons / checkbox / "Download PNG" button).

## Known limits / next steps
- 4× on a very large graph will silently downgrade. We currently don't surface the effective scale back to the user.
- `html-to-image`'s foreignObject pipeline still has minor rendering quirks (subpixel borders, complex shadows). For truly print-quality output we'd want SVG export or per-node canvas painting — out of scope here.
- The interactive HTML hand-off discussed alongside this fix is not implemented; tracked as a separate piece of work.
