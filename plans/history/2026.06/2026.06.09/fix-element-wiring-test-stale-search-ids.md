# Fix: viewer-element-wiring test failing on removed toolbar search IDs

The user reported that the `Webview element ID wiring` test failed: `getElementById references to non-existent HTML elements` listing `toolbar-search-count` and `toolbar-search-btn`. The toolbar refactor on this branch removed the toolbar search button (and its match-count badge), but the webview scripts still keep null-guarded `getElementById` lookups for those IDs. The cross-reference test flagged them as references to elements absent from the static HTML.

## Finish Report (2026-06-09)

This work will be reviewed by another AI.

### Scope

**(B/C)** VS Code extension — test-only change. One file: `src/test/ui/viewer-element-wiring.test.ts`. No production TypeScript, no HTML, no webview script behavior changed.

### Root cause

`viewer-element-wiring.test.ts` cross-references every `getElementById('x')` in the injected webview scripts against `id="x"` in the generated HTML body. Two script lookups had no matching static element:

- `src/ui/viewer-toolbar/viewer-toolbar-script.ts:19` — `searchBtn = getElementById('toolbar-search-btn')`
- `src/ui/viewer-search-filter/viewer-search.ts:29` — `toolbarSearchBadge = getElementById('toolbar-search-count')`

Both belong to the old toolbar search button, which was deliberately removed and replaced by the flow-map export button (documented in `viewer-toolbar-script.ts:166-168`). The scripts intentionally keep the lookups (now resolving to `null`) so their consumers no-op harmlessly:
- `searchBtn` guarded at `viewer-toolbar-script.ts:66, 74` (aria-expanded updates)
- `toolbarSearchBadge` guarded at `viewer-search.ts:89, 203-204` (match-count text)

This is exactly the `staleIds` category the test defines: "IDs from removed UI that are still referenced in scripts but guarded by null checks (harmless no-ops)."

### Fix

Added `toolbar-search-btn` and `toolbar-search-count` to the `staleIds` allowlist in the test, with a comment explaining the removal and why the null-guarded lookups remain. The companion "no stale allowlist" test confirms both are still referenced in scripts, so the entries are justified rather than dead weight.

### Testing

- Audited the test directory: grep for `toolbar-search-btn`, `toolbar-search-count`, `toolbarSearchBadge`, `searchBtn` under `src/test/` — the only matches are in `viewer-element-wiring.test.ts` itself. No other test pins these IDs.
- Ran `npm run compile-tests` then `npm run test:file -- out/test/ui/viewer-element-wiring.test.js` (vscode-test Extension Host). Result: **2 passing** — both the "every getElementById references an element" test and the "no stale allowlist" test pass.

### Project maintenance

- CHANGELOG: not updated — no user-visible behavior changed (test allowlist only).
- README verified — no updates needed.
- No bug archive — task did not close a `bugs/*.md` file.

### Files changed

- `src/test/ui/viewer-element-wiring.test.ts` — two IDs + comment added to `staleIds`.
- `plans/history/2026.06/2026.06.09/fix-element-wiring-test-stale-search-ids.md` — this report.

Finish report saved: `plans/history/2026.06/2026.06.09/fix-element-wiring-test-stale-search-ids.md`
