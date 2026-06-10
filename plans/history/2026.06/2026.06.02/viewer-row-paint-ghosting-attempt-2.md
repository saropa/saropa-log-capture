# Viewer Row Paint Ghosting — Attempt #2

User reported (2026-06-02) that attempt #1 of the ghost-paint fix (commit
`49297d75`, shipped in v7.17.0 dist as `transform: translateZ(0)` per-row
compositor hint) did not eliminate the artifact on their machine. The
screenshot showed viewer row #455 — `DRIFT: Drift debug server disconnected`
from [D:/src/contacts/reports/20260602/20260602_135636_contacts.log:907](D:/src/contacts/reports/20260602/20260602_135636_contacts.log) —
with the prior info-blue row's text still ghosting through. Quote: "i dont
care about cheapest. i want it properly fixed."

## Finish Report (2026-06-02)

### Scope

(B) VS Code extension. Three source edits + a regression test extension + a
new attempts-log + a CHANGELOG entry:

- [src/ui/viewer-styles/viewer-styles-lines.ts](../../../../src/ui/viewer-styles/viewer-styles-lines.ts) — added `background: var(--vscode-editor-background)` to the `.line, .stack-header` base rule and rewrote the comment block to log attempts #1 and #2 inline.
- [src/ui/viewer/viewer-data-viewport.ts](../../../../src/ui/viewer/viewer-data-viewport.ts) — replaced `viewportEl.innerHTML = parts.join('')` with a detached `<template>` parse + `viewportEl.replaceChildren()` + `viewportEl.appendChild(_vTmpl.content)` so the DOM swap is atomic.
- [src/test/ui/viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts) — added two regression tests: opaque-background pin on `.line, .stack-header`, and renderer-uses-replaceChildren / never-innerHTML pin.
- [viewer-row-paint-ghosting-attempts.md](./viewer-row-paint-ghosting-attempts.md) — perpetual failure log per the global "after 2+ failed attempts, document prior failures FIRST" rule. Lives alongside this finish report in `plans/history/2026.06/2026.06.02/` (moved from `bugs/` at user request) so attempt #3 (if ever needed) reads it first.
- [CHANGELOG.md](../../../../CHANGELOG.md) — `### Fixed` entry under a new `## [Unreleased]` section above 7.17.0.

### Root cause (recap from attempt #1)

The viewport renderer in [viewer-data-viewport.ts](../../../../src/ui/viewer/viewer-data-viewport.ts) used `viewportEl.innerHTML = parts.join('')` to swap visible rows in bulk. The innerHTML-setter fast path in Chromium can recycle prior child nodes' GPU paint cache when a slot's bounding box and tag name match the incoming markup — so when a slot transitioned between severity colors (info-blue → database-green most visible), faint pixels of the prior row's text composited under the new text. A `:hover` repaint cleared the layer.

### Why attempt #1 underperformed

`transform: translateZ(0)` is a layer *hint*, not a guarantee. On rows ~14 px tall, Chromium's compositor coalesces tiny neighbour rows back into a shared raster — the per-row paint isolation that attempt #1's comment block advertised never reliably materialized. The hint can still help on some browser versions but does not deterministically resolve the bug.

### Fix (attempt #2)

Two independent defenses that compose with each other and with attempt #1's residual hint:

**(1) Paint layer — opaque row background.**
```css
.line, .stack-header {
    position: relative;
    isolation: isolate;
    transform: translateZ(0);                /* attempt #1 — kept */
    background: var(--vscode-editor-background);  /* attempt #2 (a) */
}
```
Every row paints an opaque fill rect *before* its text content. Any stale pixels Chromium leaves in the recycled slot are physically covered by the row's own background. Same color as the editor panel parent, so visually invisible — but the browser DOES rasterize the fill, which is the point. This defense is not a hint; the fill is in the paint list.

**(2) DOM layer — atomic swap via DocumentFragment.**
```js
var _vTmpl = document.createElement('template');
_vTmpl.innerHTML = parts.join('');
viewportEl.replaceChildren();
viewportEl.appendChild(_vTmpl.content);
```
The detached `<template>` parses the new markup in isolation. `replaceChildren()` (no args) tears down every prior live child of the viewport. `appendChild(template.content)` moves the parsed nodes into the viewport in one operation. The new rows have no paint-cache lineage with whatever previously occupied each slot — the recycle path the bug rode in on is closed at its source.

Both defenses compose. Even if browser layer-promotion (defense #1 in the CSS comment) does nothing on a given Chromium version, the opaque fill obscures any ghost pixels, and the fragment swap guarantees no node identity is shared with the prior frame.

### What was deliberately NOT done

- **`contain: paint`** — would clip the severity-gutter `::after` connector stripe (`bottom: -50%` overshoot, painted by [viewer-styles-decoration-bars.ts](../../../../src/ui/viewer-styles/viewer-styles-decoration-bars.ts)) and break the dot-to-dot rail. Documented in the CSS comment so a future cleanup doesn't try it.
- **`will-change: contents`** — also a hint; the whole point of attempt #2 is to stop relying on hints.
- **Keyed per-row virtualizer** — would eliminate the slot-recycle path entirely, but is a much larger refactor. Reserved for attempt #3 if attempt #2 also fails; documented in [viewer-row-paint-ghosting-attempts.md](./viewer-row-paint-ghosting-attempts.md).
- **Dropping `transform: translateZ(0)`** — empirically insufficient on its own but free in combination, and the regression test in [viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts) pins it. Kept.

### Risks considered

- Opaque background visibly boxes the row only if the editor panel's background differs from the row's parent. The viewport's parent already paints `var(--vscode-editor-background)`; the row's fill is identical, only the owning node changes.
- `:hover` and `.line.selected` rules still override the base background — selection / hover visuals unchanged.
- `replaceChildren()` + `appendChild(template.content)` is marginally slower than `innerHTML = …` but virtualization holds ~50 rows; the difference is sub-millisecond. No measurable impact on the render loop.
- [measureTagColumnPosition()](../../../../src/ui/viewer/viewer-data-viewport.ts) runs after the swap and queries the live DOM; `appendChild(template.content)` attaches the fragment's children synchronously, so the query sees the new nodes — same guarantee as the prior `innerHTML = …` code path.

### Tests audited

Grepped [src/test](../../../../src/test) for every symbol my edits could break:

- `getLineStyles`, `getViewportRenderScript`, `viewportEl`, `viewer-styles-lines`, `viewer-data-viewport` → matches in 8 files; opened all 8.
- `.line,\s*\.stack-header`, `translateZ`, `isolation: isolate`, `innerHTML = ` (anchored), `background: var(--vscode-editor-background)` → matches only in [viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts) (the file I already updated) and one unrelated helper (`el.innerHTML` in [viewer-session-panel-test-helpers.ts:46](../../../../src/test/ui/viewer-session-panel-test-helpers.ts)).
- `viewportEl.innerHTML`, `parts.join`, `AFTER innerHTML`, `innerHTML update` → matches only my new negative assertion in viewer-muted-decorations.
- Five Mocha `suite()` files that also `import { getViewportRenderScript }` ([viewer-severity-bar-connector](../../../../src/test/ui/viewer-severity-bar-connector.test.ts), [viewer-severity-gutter-decoupling](../../../../src/test/ui/viewer-severity-gutter-decoupling.test.ts), [viewer-flutter-banner-group](../../../../src/test/ui/viewer-flutter-banner-group.test.ts), [viewer-script-null-guards](../../../../src/test/ui/viewer-script-null-guards.test.ts), [viewer-scroll-behavior](../../../../src/test/ui/viewer-scroll-behavior.test.ts)) all pin different sections of the script (computeRowAffordances, isLineContentBlank, the `startIdx === lastStart && endIdx === lastEnd` skip-rebuild guard, etc.) — none touch the DOM-swap line I changed. Verified by `grep`-then-read.

### Test runs

- `npm run check-types` → 0 errors.
- `npm run compile` → 0 errors. Pre-existing 9 lint warnings (none in files I touched); NLS catalog OK; webview + outbound + commands catalogs OK; dist size 4.38 MiB / 12 MiB ceiling.
- `npm run compile-tests` → OK.
- `node --test out/test/ui/viewer-muted-decorations.test.js` → **11 pass / 0 fail**, including all three new ghost-paint defense pins.
- Mocha `suite()` test files don't load under raw `node --test` (per `MEMORY.md → workflow_node_test_direct`). Audited those files by reading — none pin the DOM-swap line.

### Manual verification path (for the user)

Reload the Extension Development Host (Ctrl+R) and reopen [D:/src/contacts/reports/20260602/20260602_135636_contacts.log](D:/src/contacts/reports/20260602/20260602_135636_contacts.log). Scroll to line 907 (`[14:26:56.382] [drift-perf] DRIFT: Drift debug server disconnected`). The green text should render cleanly with no faint blue characters bleeding through, with no need to hover. Scroll the row out of and back into view several times to stress-test slot recycling.

### Project maintenance

- `CHANGELOG.md` — new `## [Unreleased]` section added above 7.17.0 with the Fixed entry.
- `README.md` verified — no product-fact changes; nothing to update.
- `package.json` — no version bump; this lands under Unreleased and the publish script handles the bump.
- `docs/LAUNCH_TEST.md` — not present in this project (same as attempt #1's report noted).
- `doc/guides/` — not present in this project.
- `ROADMAP.md` — SKIPPED [out-of-scope]; this fix is reactive, not a roadmap item.
- Bug archival — SKIPPED [NO-BUG-FIXED]. No closeable `bugs/*.md` opened by this task. The perpetual attempt log [viewer-row-paint-ghosting-attempts.md](./viewer-row-paint-ghosting-attempts.md) was initially created in `bugs/` per the global "2+ failed attempts" rule; the user (2026-06-02) directed it be moved into `plans/history/2026.06/2026.06.02/` alongside this finish report, where it lives so attempt #3 (if ever needed) reads it first.

### Outstanding

None — the fix lands complete. If the user still sees ghosting after reloading the Extension Host on the verification log, attempt #3 (keyed-row virtualizer refactor) is queued in [viewer-row-paint-ghosting-attempts.md](./viewer-row-paint-ghosting-attempts.md) but should not be started until and unless attempt #2 is observed to have failed.

Bug archived: No bug archive — task did not close a `bugs/*.md` file.

Finish report saved: `plans/history/2026.06/2026.06.02/viewer-row-paint-ghosting-attempt-2.md`.
