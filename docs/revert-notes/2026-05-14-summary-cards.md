# Top-bar summary cards — 2026-05-14

Two compact at-a-glance cards now sit in the header top row, centred
between the title block and the search input.

1. **Target company card** — name + status pill (active / inactive
   colour-coded), director count (Users icon), registered address
   (MapPin icon). Clicking it opens the same details panel a node
   click does (calls the existing `focusNode`).
2. **Canvas stats card** — counts of Companies / Officers / PSCs /
   Addresses, separator, then total Connections. Uses the same icon
   set as `BusinessCardNode` for visual continuity.

Both cards are single-line pills, height `44px`, designed to leave the
search input room and to survive future search-area expansions without
needing to be moved (the centre region uses `flex-1 justify-center`).
Labels are replaced with icons + tooltips to keep the footprint tight.

## Files added (delete to revert)

- `src/components/canvas/SummaryCards.tsx`

## Files modified

### `src/components/GraphCanvas.tsx`

- Imports `SummaryCards`.
- In the header top row, inserts a new centred container between the
  title block and the search form:
  ```tsx
  <div className="flex-1 flex items-center justify-center min-w-0 pt-2">
    <SummaryCards nodes={nodes} edges={edges} onTargetClick={focusNode} />
  </div>
  ```

## To revert

1. Delete `src/components/canvas/SummaryCards.tsx`.
2. Remove the import + the new `<div>` block in `GraphCanvas.tsx`.

## Why these decisions

- **Header row over toolbar row.** The toolbar row is already busy
  (Filters / Depth / Expand / Layout / Spacing / Results / Export /
  Help). Header top row had empty middle space.
- **Header row over floating canvas overlay.** Overlay risks hiding
  nodes near the top of the graph. The user has flagged a coming
  expansion of the search area — flex layout makes it trivial to shrink
  the centre region later.
- **`findRootNodeId` for the target.** Same helper the hover-path
  highlight already uses (prefers `data.role === 'Target Company'`,
  falls back to the first company), so target identification stays
  consistent across the app even after merges, deletions, or custom
  nodes are added.
- **Officer count via edges, not data flag.** Counts officer-typed
  neighbours connected to the target — robust to canvas edits, custom
  links, and the existing `officer|psc` dual-role nodes.
- **Icon-only labels.** Keeps the card narrow enough to coexist with
  the eventual expanded search UI. Hover tooltips spell out what each
  icon means.
- **Auto-hides.** When the canvas is empty (no target + zero
  companies) the entire group renders nothing — no empty-state
  scaffolding to dismiss on first load.

## Follow-up: card behaves like a Home button (same day)

The target card click now only recentres the viewport on the target
node — it does not pop the details dialog. Hovering swaps the
Building2 icon for a Crosshair to telegraph the navigation intent;
tooltip reads "Recentre canvas on {company}".

- `GraphCanvas` gains `homeToNode(node)` — recentre-only callback
  (`setCenter(...{ zoom: 1.5, duration: 600 })`), no dialog open, no
  side panel toggle. `focusNode` is unchanged (still used by the
  filtered-results panel where opening the dialog makes sense).
- `SummaryCards` `onTargetClick` is now wired to `homeToNode`.

## Follow-up: address dedup is more lenient (same day)

`normalizeAddressKey` in `GraphCanvas.tsx` rebuilt to use
`postal_code | norm(premises + address_line_1)` instead of stitching
every structured field. CH returns the same premises with different
shapes across endpoints — the registered-office payload typically has
`premises: "Unit 4c"` + `address_line_1: "Park Road"`, while officer
correspondence merges them into `address_line_1: "Unit 4c, Park Road"`.
Concatenating premises + line1 before normalising lets both forms
collapse to the same token, then the postcode anchors identity. Falls
back to the full key when no postcode is present (very rare for UK
records).

