# Configurable export with per-type Excel tabs — 2026-05-14

Replaces the single-sheet "Network" export with an opt-in dialog that
lets the user pick which entity types appear in CSV / Excel / JSON
exports. Screenshot is unchanged — there's nothing meaningful to filter
on a PNG.

## What the user sees

1. Clicking `Export → Excel / CSV / JSON` opens an `ExportOptionsDialog`
   instead of triggering a download immediately.
2. The dialog lists each node type (Companies, Officers, PSCs,
   Addresses, Notes) with a checkbox + live count of how many of that
   type exist on the current canvas. Disabled rows when count is 0.
3. A "Connections" toggle adds the edges between selected entities to
   the export.
4. **Excel.** Workbook contains one tab per ticked type
   (`Companies`, `Officers`, `PSCs`, `Addresses`, `Notes`), each with
   columns tailored to that type. A **Combined** tab is included when
   more than one type is ticked (preserves the previous behaviour for
   wide pivots). A **Connections** tab is included when the toggle is
   on (From / From Type / To / To Type / Relationship).
5. **CSV.** Single sheet using the Combined view (or the sole selected
   type if only one is ticked) — CSV has no concept of tabs.
6. **JSON.** Filtered nodes + edges + the chosen options serialised
   under `metadata.exportOptions`.

## Files added (delete to revert)

- `src/components/canvas/ExportOptionsDialog.tsx`
- `src/lib/export.ts`

## Files modified

### `src/components/GraphCanvas.tsx`

- Imports: dropped `getSicDescription` (moved into `src/lib/export.ts`);
  added `ExportOptionsDialog`, `ExportFormat`, `ExportOptions`, and the
  three builders (`buildExportSheets`, `buildFlatRows`, `countsByType`,
  `filterForJson`).
- New state: `exportFormat: ExportFormat | null` — when non-null the
  dialog is open.
- New memo `exportCounts = countsByType(nodes, edges)` feeds the dialog
  count badges.
- `buildExportRows`, `exportToCSV`, `exportToExcel`, `exportToJSON`
  were deleted. Replaced by `runExportCSV(options)`,
  `runExportExcel(options)`, `runExportJSON(options)` plus a
  `handleExportConfirm(options)` dispatcher keyed on `exportFormat`.
- `<ExportMenu>` callbacks now just `setExportFormat('csv' | 'excel' |
  'json')` instead of firing exports directly. Screenshot still calls
  `downloadImage` straight through.
- `<ExportOptionsDialog>` mounted at the bottom of the canvas
  component tree.

### `src/lib/export.ts` (new)

- `countsByType(nodes, edges)` → per-option counts.
- `buildExportSheets(nodes, edges, options)` → `{ name, rows }[]` —
  emits Combined first (when >1 type ticked), then one sheet per type
  (only when the type has rows), then Connections (when edges toggle
  is on). Each sheet has type-specific columns:
  - Companies: Name, Number, Status, Incorporated, Type, SICs,
    Registered Address, Notes
  - Officers: Name, Role, Nationality, Country of Residence,
    Occupation, Appointed On, Correspondence Address, Officer ID, Notes
  - PSCs: Name, Nationality, Natures of Control, Country of Residence,
    Notified On, Notes
  - Addresses: full broken-down address fields, Role, Linked Entities
  - Notes: Note text, X, Y
  - Connections: From / From Type / To / To Type / Relationship
- `buildFlatRows(...)` → flat list for CSV (Combined or single-type).
- `filterForJson(...)` → `{ nodes, edges }` after applying options.
- Dual-role officer+psc nodes (`data.type === 'officer|psc'`) appear
  in both the Officers and PSCs sheets when both are selected; this
  matches how the canvas treats them.

### `src/components/canvas/ExportOptionsDialog.tsx` (new)

- Radix `Dialog` + custom `Checkbox` (no checkbox primitive in this
  repo yet). Five type rows + a separated Connections row. Footer
  shows "N rows will be exported" tally and brand-navy Export button.
- Defaults to **everything on** (`DEFAULT_EXPORT_OPTIONS`), so the
  single-tick flow remains as fast as the old one-click export.

## To revert

1. Delete the two new files (`ExportOptionsDialog.tsx`,
   `src/lib/export.ts`).
2. Revert `src/components/GraphCanvas.tsx` to its previous git version
   (which restores the inline `buildExportRows` + the three direct
   `exportToCSV/Excel/JSON` callbacks wired into `<ExportMenu>`).

## Why these decisions

- **Per-type tabs.** The old "everything in one row" sheet had sparse
  columns whenever an entity wasn't a company (most rows had blank
  Officer columns or blank Address columns). Per-type sheets keep the
  columns tight while the Combined tab preserves cross-entity analysis.
- **Combined only when >1 type.** A single-type export already lives on
  its own tab; a duplicate Combined sheet would just be churn.
- **Empty sheets skipped.** XLSX rejects truly empty sheets and they're
  noisy regardless.
- **CSV stays single-sheet.** Multi-tab CSV isn't a thing; falling back
  to Combined preserves the previous behaviour for users who CSV.
- **Defaults to everything on.** Keeps the one-click vibe — power users
  who want a filtered export just untick boxes.

## Follow-up: scope toggle (same day)

Added a `scope: 'all' | 'filtered'` field to `ExportOptions` so the
dialog can export either everything on the canvas or only what survives
the current Status / SIC filters.

- New segmented toggle at the top of the dialog (**All on canvas** /
  **Only filtered**) — only rendered when at least one filter is
  active, otherwise hidden to keep the dialog clean.
- Per-row counts switch between `allCounts` and `filteredCounts` as
  the user flips the toggle, so it's always clear what each format
  will contain.
- Default scope when filters are active is `'filtered'` (matches the
  user's intent — "export what I'm looking at"). With no filters
  active, defaults to `'all'`.
- `buildExportSheets`, `buildFlatRows`, `filterForJson` gained an
  optional `visibleNodeIds?: Set<string>` argument; an internal
  `applyScope` helper narrows nodes/edges before the per-type builders
  run. Edges with an endpoint outside the visible set are dropped so
  the Connections tab doesn't grow dangling rows.
- `GraphCanvas` now derives `hasActiveFilter`, `allExportCounts` and
  `filteredExportCounts` and passes all three to the dialog; the three
  runners (`runExportCSV / Excel / JSON`) thread `visibleNodeIds` into
  the helpers.

No new files for this follow-up — same two files
(`ExportOptionsDialog.tsx`, `src/lib/export.ts`) and `GraphCanvas.tsx`.
