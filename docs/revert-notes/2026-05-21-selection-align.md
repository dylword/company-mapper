# Selection alignment action — 2026-05-21

## What changed
Added an "Align" option to the rectangle-selection action toolbar, alongside
Expand / Recolor / Delete.

- **`src/components/canvas/SelectionActionBar.tsx`**
  - New `onAlign` prop and exported `AlignAxis` type.
  - New align popover (trigger between Recolor and Delete) with a 3×2 grid:
    left / centre / right / top / middle / bottom.
  - Disabled unless 2+ nodes are selected.
- **`src/components/GraphCanvas.tsx`**
  - New `handleAlignSelected` callback — computes the bounding box of the
    selected nodes and snaps each to the chosen edge/axis. Passed as `onAlign`.

## Behaviour
- Operates only on rectangle-selected nodes (`n.selected`); others untouched.
- Uses each node's measured `width`/`height` for right/bottom/centre maths.
- After aligning, nodes are distributed evenly along the perpendicular axis
  (max node size + 32px gap), preserving their original order — prevents
  overlap/stacking.
- No-op with fewer than 2 selected nodes.

## Related: partial box selection
`GraphCanvas.tsx` ReactFlow now uses `selectionMode={SelectionMode.Partial}`
(import added) so the rectangle selects any node it touches, not only fully
enclosed ones.

## How to revert
Remove the `onAlign` prop + align popover + `AlignAxis` export from
`SelectionActionBar.tsx`, delete `handleAlignSelected` and the `onAlign={...}`
prop in `GraphCanvas.tsx`, and remove the `selectionMode` prop + `SelectionMode`
import.
