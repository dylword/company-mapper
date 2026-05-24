# 2026-05-24 — Dedup tightening (addresses + people)

## What changed
Two small but related dedup tweaks driven by a Prime Properties Battersea Ltd graph where the same person and the same physical address appeared as multiple nodes.

### 1. Address node dedup — `src/components/GraphCanvas.tsx`
`normalizeAddressKey` rewritten. Key was `postcode|premises+line1` (normalised), which fragmented when Companies House returned the same address with different premises strings (typos like "Creative Drive" vs "Creative House", or premises/line1 split differently across endpoints).

New key: `postcode|<flat-number>`, where flat-number is extracted by matching `/\b(flat|apt|apartment|unit|suite|studio)\s*([a-z0-9]+)/i` against premises + line1 + line2. No sub-unit → postcode-only fallback.

Effect: same postcode + same flat collapses to one node regardless of how the street portion is structured. Different flats at the same postcode stay separate.

### 2. Person dedup — `src/lib/matchUtils.ts`
Added `extractForename` helper (mirrors `extractSurname`: uses `name_elements.forename` for PSCs, first token after the comma for officers, falls back to first whitespace token).

Old probable-match rule was `sameSurname && samePostcode`, which flagged family members (shared surname + home postcode). New rule is `sameSurname && sameForename && samePostcode` and it now sets `isDefinite = true` (auto-merge into the `officer|psc` combined node), not `isProbable`.

Effect: same full name at same postcode merges silently with no "Possible duplicate" pill. Family members no longer flag.

Probable-match branch is now dead code — nothing sets `isProbable = true`. Left in place for future looser rules; safe to delete.

## How to revert
`git revert <commit>` — both edits are localised to the two files above. No data migrations, no UI/contract changes.

## Risk
- Address: postcode-only fallback could over-merge non-residential addresses with no flat number that share a postcode. Acceptable in practice (UK postcodes ~15 addresses on average).
- People: requires forename equality after `normalize()` (lowercase, alphanumerics only). "John" vs "Jonathan" still stay separate — intentional, since we have no fuzzy matcher and DoB-based definite rules already cover the nickname case when DoB is present.
