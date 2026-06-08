# SQL Query History: fix corrupt drift status line + disable headers when empty

**Trigger (user request, verbatim):** "1. there is a message in the 'SQL Query History' tab
but it is corrupt 2. does the count, SQL and slow links work if there is no data? if not make
them visibly disabled with an explanatory tooltip"

The SQL Query History panel's "Drift viewer (from log)" status line rendered as
`http://127.0.0.1:8642banner v3.5.1 · unreachable (fetch failed)` — the base URL ran straight
into the banner version with no separator. Separately, the Count / SQL / Slow column headers are
clickable sort toggles that silently did nothing when no SQL had been captured, and gave no
indication they were inert.

## Finish Report (2026-06-08)

### Scope

(B) VS Code extension (TypeScript). Webview panel script + helpers + styles, one webview l10n
string, one test file, the changelog. No Flutter/Dart, no ARB, no host-built copy strings.

### Changes

1. **Corrupt drift status — `viewer-sql-query-history-panel-script.ts`.**
   `updateSqlQueryHistoryDriftStatusImpl` builds an array of parts and `join('')`s them. The
   health parts (`' · reachable'`, `' · unreachable …'`) each carry a leading `' · '`, but the
   banner part was `'banner v' + d.version'` with no separator, so it abutted the base URL. Changed
   to `' · banner v' + d.version` and added a WHY comment naming the join('')-without-separator
   failure mode. Status now reads `… · banner v3.5.1 · unreachable (fetch failed)`.

2. **Disabled headers — `viewer-sql-query-history-panel-helpers.ts`.**
   Added `setSqlHistoryHeaderEnabled(el, enabled)`: stashes each header's original `title` once in
   `data-orig-title` (only the Slow header ships one), toggles `.sql-qh-header-disabled`, and on
   disable sets `aria-disabled="true"`, `tabindex="-1"`, and the tooltip via
   `vt('viewer.sqlHistory.sortDisabled')`; on enable restores the original title/tabindex and clears
   aria-disabled. `updateSqlHistorySortHeaders` now computes `hasData` from
   `getSqlQueryHistoryRowsForRender().length > 0`, suppresses the sort-direction caret when there's
   no data, and calls the new helper per header. Because `updateSqlHistorySortHeaders` already runs
   on init, after every render, and after every sort, the enable/disable tracks data arrival
   automatically.

3. **Sort-handler guard — `viewer-sql-query-history-panel-script.ts`.**
   `handleSortActivate` now early-returns when the header's `aria-disabled === 'true'`, so keyboard
   Enter/Space can't bypass the visual disable (CSS `pointer-events: none` already blocks the mouse).

4. **Styles — `viewer-styles-sql-query-history.ts`.**
   New `.sql-qh-header-disabled` rule: `opacity: 0.4; cursor: default; pointer-events: none;` so the
   headers read as inert.

5. **L10n — `strings-webview-b.ts`.**
   Added `'viewer.sqlHistory.sortDisabled': 'No SQL queries captured yet — nothing to sort.'`. This
   feeds the webview `__VT` map automatically (built from `stringsWebviewB` in `l10n.ts`); untranslated
   locales fall back to English via `vscode.l10n.t()`, so no `bundle.l10n.*.json` edits are required and
   no NLS parity gate is triggered (those apply to `package.nls` `%keys%` only).

### Deep Review

- **Logic & Safety:** No async, no recursion. The header enable/disable is idempotent and derives
  from a single source (`getSqlQueryHistoryRowsForRender().length`). `data-orig-title` is captured
  exactly once per element via the `hasAttribute` guard, so repeated renders don't overwrite the
  real title with the disabled placeholder.
- **Architecture & Adherence:** Stays within the existing panel modules; no new files, no
  shared-primitive changes. The disabled state is expressed the same way the rest of the webview
  expresses visibility (class toggle + aria), and the tooltip routes through the existing `vt()`
  pipeline rather than a hardcoded literal.
- **Performance/UX:** `getSqlQueryHistoryRowsForRender()` runs once more per header-update (a plain
  object iteration over already-in-memory fingerprints) — negligible. The headers now give a clear
  affordance: dimmed + cursor default + explanatory tooltip when there's nothing to sort.
- **Documentation:** WHY comments added at both the separator fix and the disable logic naming the
  exact failure mode each prevents (URL abutment; silent no-op click).

### Testing

- **Audit:** Grepped `src/test` for `banner v`, `driftDebugServerFromLog`, `sql-qh-header`,
  `col.slow`, `col.count`, `sortDisabled`, `updateSqlQueryHistoryDriftStatus`. Two test files
  matched:
  - `viewer-sql-query-history-panel-html.test.ts` pins `title="Slowest duration in milliseconds"`
    on the static HTML — unaffected, because HTML generation is unchanged (the title is only mutated
    at runtime, and restored from `data-orig-title`). Left as-is.
  - `level-classifier.test.ts` "match all common Flutter banner variants" is about Flutter framework
    banners, unrelated to the drift-status "banner v" string. Left as-is.
- **New tests (`viewer-sql-query-history-panel-script.test.ts`):** added
  "sort headers disable with explanatory tooltip when no SQL captured" (asserts the
  `sql-qh-header-disabled` class toggle, the `viewer.sqlHistory.sortDisabled` key, and the
  `aria-disabled` guard in the handler) and "drift status banner version carries its own separator"
  (asserts `' · banner v'` present and no separator-less `'banner v'` remains).
- **Run:** `npm run test:file -- out/test/ui/viewer-sql-query-history-panel-script.test.js` →
  26 passing (24 prior + 2 new). The file transitively imports `vscode` via `l10n`, so it runs in
  the Extension Host, not `node --test`.
- **Typecheck:** `npm run check-types` → clean.

### Files changed

- `src/ui/viewer-panels/viewer-sql-query-history-panel-script.ts` — `' · '` separator before banner; sort-handler `aria-disabled` guard.
- `src/ui/viewer-panels/viewer-sql-query-history-panel-helpers.ts` — `setSqlHistoryHeaderEnabled` + `hasData`-driven `updateSqlHistorySortHeaders`.
- `src/ui/viewer-styles/viewer-styles-sql-query-history.ts` — `.sql-qh-header-disabled` rule.
- `src/l10n/strings-webview-b.ts` — `viewer.sqlHistory.sortDisabled` string.
- `src/test/ui/viewer-sql-query-history-panel-script.test.ts` — two new assertions.
- `CHANGELOG.md` — two `[Unreleased]` Fixed entries.
- `plans/history/2026.06/2026.06.08/sql-history-drift-status-and-disabled-headers.md` — this report.

### Outstanding

None. No bug archived — task did not close a `bugs/*.md` file.
