# Hover highlight is strict 1-hop — 2026-05-14

## What changed

The hover (and selected-node) highlight in `GraphCanvas.tsx` now only
expands from the hovered node itself. Every neighbour is terminal —
the BFS adds it to the visible set but does not walk through it.

Previously the BFS stopped at companies and addresses but continued
through officers / PSCs. That meant hovering an address would
highlight the address → its connected officer → and then **every other
company that officer was a director of** — none of which actually share
that address. With the new rule, hovering the address highlights
exactly: the address + its direct neighbours (the officer and the
company whose registered office it is) + the path back to the search
target. KHAN's other companies stay dimmed, as intended.

## File modified

### `src/components/GraphCanvas.tsx`

Inside the `useEffect` that computes hover visibility, the inner BFS
loop replaces the type-based stop list with a strict
`if (currId !== activeNodeId) continue;`. The "path back to root" block
below is unchanged — that's still what surfaces the chain from
hovered-node → target.

## To revert

Restore the previous BFS body:
```ts
const stopType = currNode?.data?.type;
if ((stopType === 'company' || stopType === 'address') && currId !== activeNodeId) {
    continue;
}
```

## Why this decision

- Strict 1-hop matches the user's mental model: "show me what's
  directly attached, plus the breadcrumb to the target".
- Per-type stop lists were brittle — adding a new node type (PSCs,
  custom entities, future "owner" or "director-of-director") would
  silently re-introduce the bleed-through.
- The path-to-target block (`tracePath`) still highlights the spine,
  so hovering a far-flung node doesn't lose context.
