# Search bar autocomplete — 2026-05-21

## What changed
Added type-ahead company suggestions to the header search field.

- **New:** `src/components/canvas/CompanySearchBar.tsx` — controlled search input
  with a debounced (300ms, min 3 chars) lookup against `/api/search`, a
  suggestion dropdown (name, status pill, company number, address), keyboard
  navigation (↑/↓/Enter/Esc), and outside-click dismissal.
- **Changed:** `src/components/GraphCanvas.tsx` — replaced the inline
  uncontrolled `<form>` search field with `<CompanySearchBar />`; added its import.

## Behaviour notes
- Picking a suggestion navigates with `?q=<company_number>`. GraphCanvas already
  treats an 8-digit numeric `q` as a company number, so this skips the redundant
  `/api/search` call the free-text path makes.
- Free-text submit (button / Enter with no highlighted item) still navigates by
  the typed name, unchanged from before.
- Uses `chFetch`, so autocomplete calls respect Companies House rate limits.
  Debounce + 3-char minimum keep keystroke-driven calls bounded.

## How to revert
Restore the original `<form>` block in `GraphCanvas.tsx` (see git history for
commit before this change), remove the `CompanySearchBar` import, and delete
`src/components/canvas/CompanySearchBar.tsx`.
