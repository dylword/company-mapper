# Hover highlight extends to the connection path — 2026-05-14

Follow-up to `2026-05-14-help-loading-path.md`.

## Problem

When hovering a node that was 2+ hops from the originally-searched
company, the highlight effect only kept that node's immediate cluster at
full opacity. The trail back to the search target was dimmed, even
though the new connection-path card was correctly describing it. The
user expected the hover to visually mirror the card.

## Change

In `src/components/GraphCanvas.tsx`, the highlight `useEffect` already
computed a `connectedNodeIds` / `connectedEdgeIds` set via local BFS
(which stops at company nodes). After that BFS, we now additionally:

1. Resolve the root node via `findRootNodeId(nodes)` (same heuristic the
   connection-path card uses — prefers `data.role === 'Target Company'`).
2. If the active (hovered/selected) node is not the root itself, run
   `tracePath(root, active, nodes, edges)` and merge every node + edge
   on the shortest path into the connected sets.

Net effect: hovering any descendant lights up the entire trail back to
the initial search target, so the route is visible at a glance.

## Files modified

- `src/components/GraphCanvas.tsx` — imports `tracePath`/`findRootNodeId`
  from `@/lib/connection-path` and unions the path nodes/edges into the
  existing highlight sets.

## Follow-up: stop local BFS at addresses too

Initial version stopped the local hover BFS at company nodes but not
address nodes. That meant hovering an officer pulled in every company
registered at the same correspondence address, which made shared-premises
clusters (e.g. agent-of-record addresses) drown out the actual route.

Now the local BFS also stops at address nodes — *unless* the address is
the hovered node itself, in which case we still want to expose every
entity that shares the premises (that's literally why the user clicked
on it).

The path-to-root union added in this same change is unaffected: if the
shortest path runs *through* a shared address, that one address still
lights up along with the next company on the trail. It just no longer
spills sideways into every other company at that address.

## Notes

- No behavioural change when hovering the root itself.
- No-op when the active node has no path to the root (e.g. the user
  deleted the only bridging node) — `tracePath` returns null and we
  fall through.
- `npx tsc --noEmit` passes cleanly.
