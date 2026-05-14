# Box select + bulk recolor — 2026-05-14

Two related canvas-interaction features bundled together:

1. **Box / rectangle select.** A new mode toggle in the bottom canvas tool
   palette switches between **Pan** (default, left-drag pans the canvas)
   and **Box select** (left-drag draws a rectangle that selects every
   node inside it). Implemented with React Flow's native
   `selectionOnDrag` + `panOnDrag={[1, 2]}` props — no custom hit-test
   code. In select mode the cursor is `crosshair`; middle/right mouse
   still pan.
2. **Bulk recolor.** The existing `SelectionActionBar` (the floating
   toolbar that appears above any multi-selected nodes) gained a palette
   icon. Clicking it opens a popover with eight brand swatches plus a
   "Reset to default" option. The chosen colour writes to
   `node.data.customColor` for every selected node, which
   `BusinessCardNode` already honours for both the top accent bar and
   the role icon. Pairs naturally with box select: drag a rectangle →
   recolor the lot.

## Files modified

### `src/components/canvas/CanvasToolPalette.tsx`

- New required props `mode: "pan" | "select"` and
  `onModeChange(mode)`.
- Adds two leading `ToolButton`s (Pan / Box select) with an `active`
  state that paints them with the brand navy when current.

### `src/components/canvas/SelectionActionBar.tsx`

- New required prop `onRecolor(color: string | null)`.
- New popover-based recolor control (Palette icon). Palette values:
  `#132B5C, #10B981, #F59E0B, #64748B, #EF4444, #8B5CF6, #14B8A6, #EC4899`.
- "Reset to default" passes `null` so caller can clear `customColor`.

### `src/components/GraphCanvas.tsx`

- New state: `canvasMode: 'pan' | 'select'` (defaults `'pan'`).
- New callback `handleRecolorSelected(color)` — maps over selected
  nodes, sets `data.customColor` (or unsets when `color === null`),
  and syncs the open `NodeDetailsPanel` colour input + `selectedNode`
  ref so the dialog reflects the new colour without re-open.
- `ReactFlow` gets `selectionOnDrag={canvasMode === 'select'}` and
  `panOnDrag={canvasMode === 'select' ? [1, 2] : true}`. In select
  mode the canvas `className` adds `cursor-crosshair`.
- `CanvasToolPalette` and `SelectionActionBar` invocations wire the
  new props.

## To revert

1. Revert the three files above to their previous git versions.
2. No new files were added (everything mounted into existing
   components).

## Why these decisions

- **Toggle over hold-Shift.** Discoverable for occasional users (the
  Pan / Select pair mirrors Figma / Miro). Power users can still
  Ctrl-click or Shift-click to extend a click-based selection.
- **Native RF rectangle.** Battle-tested, zero custom code, respects
  zoom/pan automatically. The trade-off is the rectangle only triggers
  on an empty-pane drag — which matches every other graph tool we
  benchmarked.
- **`null` to reset colour.** `BusinessCardNode` keys off
  `data.customColor` being falsy to fall back to the type-based accent,
  so we explicitly delete the field rather than writing back the
  default hex.
