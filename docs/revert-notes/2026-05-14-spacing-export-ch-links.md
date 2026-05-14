# Spacing controls, export improvements, CH node links — 2026-05-14

Four user-requested features bundled into one change:

1. **Spacing controls.** A new `Spacing` popover in the canvas toolbar
   adjusts connector length (link distance) and node spacing for all
   layouts (FORCE / RADIAL / TB / LR). Changes re-run the active layout.
2. **Export filenames include the searched company.** PNG / CSV / XLSX /
   JSON exports now use `{slug(company-name)}-network-{YYYY-MM-DD}.{ext}`.
3. **JSON export.** New `Export to JSON` option in the export menu —
   serialises nodes, edges and a small metadata block (search query,
   resolved company name, layout direction, spacing values, counts).
4. **Companies House link on every node.** `BusinessCardNode` now shows an
   external-link icon in its header for company and officer nodes. For
   PSC/Officer entries whose source payload contains `links.self`
   (Companies House API), the link uses that path verbatim; otherwise:
   - Company → `/company/{company_number}`
   - Officer → `/officers/{officer_id}/appointments`

## Files added (delete to revert)

- `src/components/canvas/SpacingMenu.tsx`

## Files modified

### `src/lib/layout.ts`

- `getLayoutedElements` now accepts a 4th `LayoutOptions` param:
  `{ linkDistance, nodeSpacing }`.
- Exported `DEFAULT_LAYOUT_OPTIONS = { linkDistance: 350, nodeSpacing: 200 }`
  (matches the prior hard-coded values).
- FORCE: `linkDistance` → `forceLink().distance()`; `nodeSpacing` →
  `forceCollide().radius()`; charge strength now scales with spacing.
- RADIAL: `baseRadius = max(200, linkDistance + 150)` (was hard-coded 500).
- Dagre TB/LR: `nodesep = nodeSpacing`; `ranksep = max(60, linkDistance/3)`.

### `src/components/GraphCanvas.tsx`

- Added state: `linkDistance`, `nodeSpacing`, `searchedCompanyName`.
- `onLayout(direction, overrideOpts?)` — passes spacing to layout. Override
  param lets `onSpacingChange` apply new values in the same tick (state
  updates are async).
- `onSpacingChange` / `onSpacingReset` callbacks for the new menu.
- `setSearchedCompanyName(company.company_name)` after the company-profile
  fetch resolves.
- `exportFilename(ext)` helper builds `slug-network-date.ext`. Falls back
  to the raw `query` then to `'company-map'` when the resolved name is
  unavailable (e.g. before fetch completes).
- New `exportToJSON()` builds `{ metadata, nodes, edges }` and downloads it.
- Toolbar now renders `<SpacingMenu>` after `<LayoutMenu>` and passes
  `onExportJSON` to `<ExportMenu>`.

### `src/components/canvas/ExportMenu.tsx`

- Added required prop `onExportJSON: () => void`.
- New menu item `Export to JSON` (FileJson icon) between Excel/CSV and the
  screenshot option.

### `src/components/nodes/BusinessCardNode.tsx`

- Added `getCompaniesHouseUrl(id, data)` helper. Prefers
  `data.source.links.self` if present (officer / PSC API self link),
  otherwise builds from `data.source.company_number` (company) or
  `data.officer_id` / `data.source.officer_id` (officer).
- Custom user-added nodes (`data.isCustom`) get no link — their `id` is
  a `entity-{timestamp}` placeholder, not a real company number.
- Render an `ExternalLink` icon button next to the type icon in the card
  header when a URL is available. Uses `className="nodrag"` and
  `stopPropagation` on mousedown/click so React Flow does not interpret
  the click as a node selection or drag.

## Why

Per the user request: spacing sliders for connector length and node
gap; export filenames keyed to the searched company; JSON export for
programmatic reuse / re-import; one-click jump from any node to its
Companies House page.

## Notes

- PSC nodes only get a CH link when the source response includes
  `links.self` — which Companies House returns for both
  `individual` and `corporate-entity` PSC types. Without it, the link
  cannot be derived from the current node payload because PSC nodes
  don't store their parent company number.
- Address nodes intentionally have no CH link — there is no address page
  on `find-and-update.company-information.service.gov.uk`.
- `npx tsc --noEmit` passes cleanly.
