# Help dialog, loading indicator, connection-path card — 2026-05-14

Three onboarding / investigator-ergonomics features bundled into one
change.

1. **Help dialog** — toolbar button next to Export. Opens a Radix Dialog
   with two reference sections: the colour key for every node type, and
   one-line explanations of each expansion depth (1–5).
2. **Loading indicator** — animated top progress bar + floating chip in
   the canvas bottom-right. Driven by the existing `loading` boolean plus
   a new `loadingLabel` so it can read either "Searching Companies
   House…" or "Expanding network (N hops)…".
3. **Connection-path card** — first card in the node details panel.
   Shows the BFS-shortest chain from the originally-searched company to
   the currently-selected node, rendered as a plain-English narrative
   plus a vertical list of stops with edge labels between them.

## Files added (delete to revert)

- `src/components/canvas/HelpDialog.tsx`
- `src/components/canvas/LoadingOverlay.tsx`
- `src/lib/connection-path.ts`
- `src/components/ConnectionPathCard.tsx`

## Files modified

### `src/components/GraphCanvas.tsx`

- New imports: `HelpDialog`, `LoadingOverlay`.
- New state: `loadingLabel` (default "Searching Companies House…").
- Initial `fetchData` sets `loadingLabel = "Searching Companies House…"`
  before `setLoading(true)`.
- `handleExpandNetwork` sets `loadingLabel = "Expanding network (N hops)…"`
  before `setLoading(true)` so the chip reflects the current op.
- `<HelpDialog />` rendered at the end of the toolbar row.
- `<LoadingOverlay active={loading} label={loadingLabel} />` rendered
  inside the canvas wrapper (after `CanvasToolPalette`).
- `<NodeDetailsPanel>` now receives `nodes={nodes} edges={edges}` so it
  can compute the connection path.

### `src/components/NodeDetailsPanel.tsx`

- Now accepts optional `nodes` and `edges` props.
- Imports and renders `<ConnectionPathCard>` as the **first** scrolling
  card when both `nodes` and `edges` are non-empty.

## Why

- **Help** — user asked for a discoverability button explaining the
  colour key and what each expansion depth does. Same depth strings as
  `DepthSelect.tsx` so they stay in sync conceptually but with more
  explanation than fits in a popover row.
- **Loading** — previously the only feedback during expand was the
  "Expanding…" label on the disabled button. For long multi-hop
  expansions this felt frozen.
- **Connection-path** — investigators at depth ≥ 2 couldn't tell *why*
  a given company appeared on the map without manually tracing edges.
  The card turns "officer-abc → company-1234 → officer-def → 09999999"
  into a sentence the user can paste into a report.

## How the path is computed

`src/lib/connection-path.ts`:

- `findRootNodeId(nodes)` — prefers a node whose `data.role === 'Target Company'`
  (set in the initial fetch in `GraphCanvas.tsx`). Falls back to the first
  company-type node if the user has deleted or relabelled the original.
- `tracePath(rootId, targetId, nodes, edges)` — BFS on an undirected
  adjacency list built from `edges`. Returns `{ root, target, hops[], narrative }`.
- `describeHop(from, to, edge)` — pattern-matches on `from.data.type` →
  `to.data.type` and produces a sentence using node names:
  - company → officer: "Jane Doe is a director of TESCO PLC."
  - officer → company: "Jane Doe is also a director of OTHER LTD."
  - company → psc / psc → company: significant-control wording.
  - company → address / address → company: "registered at …".
  - officer → address / address → officer: "correspondence address is …".
- Edge labels (e.g. "Director", "Secretary", "Correspondence") feed into
  the verb so we get accurate phrasing instead of "officer of".

## Notes

- The path card is hidden when the selected node *is* the root (no path
  to draw).
- The card is also hidden if BFS finds no path — which happens when a
  user deletes the only bridging node between two clusters; the
  narrative would otherwise be confusing.
- Custom user-added entities and note nodes are walked through the same
  way; their labels will appear in the narrative as-is.
- `npx tsc --noEmit` passes cleanly.
