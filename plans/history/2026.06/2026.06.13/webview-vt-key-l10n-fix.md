# Webview vt() keys rendering raw to users — l10n placement fix

Seven user-facing strings rendered inside the log-viewer webview displayed their internal
localization key (literally `viewer.crashlytics.badge.regressed`, etc.) instead of the translated
words, in every language. The client-side `vt()` helper resolves keys against the `__VT` map, which
is built only from the webview strings files (`strings-webview*.ts`); `vt()` has no host fallback and
returns the raw key when it is absent. The four Crashlytics "Repetitive"/"Regressed" badge labels and
tooltips were authored in `strings-viewer-c.ts`, and three Session Info modal actions in
`strings-viewer-d.ts` — both host (`t()`) strings files invisible to the webview map — so each
`vt()` call site emitted the raw key. The defect was surfaced by a standalone Playwright visual
harness that renders the real webview HTML/CSS/JS under VS Code theme variables.

## Finish Report (2026-06-13)

### Scope

(B) VS Code extension (TypeScript). Two parts: a localization-placement fix under `src/l10n/`, and a
new visual-regression harness under `test/visual/`. No Flutter/Dart code; no manifest NLS strings.

### Root cause

`vt(key)` in `viewer-l10n-inject.ts` resolves `(__VT && __VT[key] != null) ? __VT[key] : key` — a
fail-soft that returns the literal key on a miss. `getWebviewL10nMap()` in `l10n.ts` builds `__VT`
from `stringsWebview` + `stringsWebviewB` only. A key defined in any `strings-viewer-*.ts` (host)
file is reachable by host `t()` but never enters `__VT`, so any `vt()` reference to it renders raw.
The host `strings` object merges the webview files too, so relocating a key from a host file to a
webview file keeps it available to both `t()` and `vt()` — the relocation is strictly safe.

### Change

The seven mis-placed keys were moved to `strings-webview.ts`, beside their already-correct Crashlytics
siblings:

- `viewer.crashlytics.badge.repetitive`, `.repetitiveTip`, `.regressed`, `.regressedTip`
  (from `strings-viewer-c.ts`)
- `viewer.sessionInfo.empty`, `.openInBrowser`, `.revealInExplorer`
  (from `strings-viewer-d.ts`)

English values are unchanged, and translation bundles key on the English text, so existing
translations continue to resolve. Breadcrumb comments at both former locations record why
client-rendered keys must live in a webview strings file.

The full surface was checked, not just the keys the harness happened to show: a sweep of all 316
distinct `vt('key')` call sites in `src/ui` against `getWebviewL10nMap()` confirmed these seven were
the only misses; after the move the sweep reports zero.

### Regression guard

`viewer-webview-l10n.test.ts` previously verified the bridge mechanics (placeholder substitution,
fail-soft fallback, injection order, a couple of sample keys) but never asserted that every `vt()`
key actually exists in the map — the gap that let this ship. A new case,
`every static vt() key used in src/ui exists in the __VT map`, statically scans every `vt('key')`
literal under `src/ui` and fails if any key is absent from `getWebviewL10nMap()`, so a future
mis-placed key fails CI instead of reaching users.

### Visual harness (test/visual/)

A Playwright harness renders the production webview document (`buildViewerHtml`) in headless Chromium
with `vscode` aliased to a stub for the `l10n.t()` call, authentic Dark + Light `--vscode-*` palettes
injected at `:root`, a stubbed `acquireVsCodeApi`, animations disabled, and a pinned slide-out slot
width. It opens each dashboard surface, feeds mock host→webview messages mirroring the real
`post({...})` shapes, and screenshots resting/hover states at narrow and wide widths. It is dev
tooling (generated `.gen/` and `.shots/` are gitignored) and carries its own `README.md`. It is the
instrument that exposed the raw-key defect.

### Config

`tsconfig.json` gained an `exclude` for build artifacts and the top-level `test/` directory. The
harness `build-entry.ts` imports `src` via esbuild and lives outside `rootDir: "src"`; without the
exclusion a bare `tsc` fails `TS6059`. The real extension tests remain under `src/test` (inside
`rootDir`) and are unaffected.

### Verification

- `npm run check-types` — clean (exit 0).
- `npm run compile-tests` — clean (exit 0).
- `npm run test:file -- out/test/ui/viewer-webview-l10n.test.js` — 5 passing in the Extension Host
  (4 existing + the new full-sweep guard; the guard reports 0 missing keys).
- Static sweep of all `vt('key')` call sites in `src/ui` against the webview map — 0 missing.
- Harness render of the Crashlytics panel — the raw `viewer.crashlytics.badge.regressed` text no
  longer appears.
- `node esbuild.js` — production bundle builds clean.

### Files changed

- `src/l10n/strings-webview.ts` — added the 7 relocated keys + explanatory comment.
- `src/l10n/strings-viewer-c.ts` — removed the 4 Crashlytics badge keys; breadcrumb comment.
- `src/l10n/strings-viewer-d.ts` — removed the 3 Session Info keys; breadcrumb comment.
- `src/test/ui/viewer-webview-l10n.test.ts` — added the full-sweep regression test + helpers.
- `tsconfig.json` — added `exclude` for build artifacts and `test/`.
- `CHANGELOG.md` — `### Fixed` entry for the raw-key defect.
- `test/visual/**` — new Playwright visual harness (gitignored generated output).

### Outstanding

Unrelated to this fix: the Crashlytics list render in the harness shows blue gradient blocks at the
right of each issue row whose origin is unconfirmed — possibly an artifact of incomplete mock issue
data, possibly a real layout defect. No code was changed for it; it needs a faithful render or a
device check before any change.
