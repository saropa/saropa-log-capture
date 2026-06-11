# Flow Map diagram S3 — zoom/scroll/center, pop-out, node detail, back arrows

Triggered by direct user requests (no bug file). The user asked, across two messages plus two
screenshots of the live panel: (1) move the dwell "time on screen" label off the arrow where it
was unreadable; (2) draw a back arrow when the session returns to a caller screen; (3) center the
flow chart; (4) stop cropping the chart when zoomed — make it a horizontally scrollable window;
(5) add a button to pop the chart into its own window; (6) double-click a node for an exhaustive
detail popup; (7) fix "Center the fault" doing a massive zoom-out. All seven landed against plan
056 (introduces stage S3). Splitter floor work from earlier the same session (drag to any ratio,
20px min, crop instead of locking to content width) is bundled in the same commit.

## Finish Report (2026-06-11)

**This work will be reviewed by another AI.**

### Scope
**(B)** VS Code extension (TypeScript) — flow-map module + webview panel. No Flutter/Dart, no
docs-only.

### Deep review
- **Logic & safety.** Back-navigation is detected with a real open-screen stack (`navStack`) in
  `flow-map-builder.ts`, replacing the single-`prevKey` immediate-pop heuristic — so returns of any
  depth (A→B→C→back to A) are caught, not just A→B→A. Back edges use a `back ` id namespace so a
  return B→A never collides with a genuine forward B→A. Back edges are excluded from
  `computeDepths` in `flow-map-svg.ts`, so the longest-path layering stays a DAG and cannot run away
  (a cycle would otherwise inflate depths every pass). The nav-stack pop (`navStack.length =
  stackIdx + 1`) is bounded by the stack and cannot underflow (guarded by `stackIdx >= 0`).
- **Zoom model.** The old viewBox-mutation zoom clipped content and let center-on-fault set a
  viewBox wider than the canvas (the "massive zoom-out" the user saw). New model: viewBox is static,
  zoom scales the SVG element's CSS width/height, so a `.diagram-scroll` container grows real
  scrollbars (no crop) and `margin:auto` centers the chart when smaller than the viewport.
  `centerCrash` now scrolls to the node at ≥1:1 instead of resizing the viewBox.
- **Architecture.** Diagram block extracted to `flowDiagramHtml(graph, withPopout)` and reused by
  both the report body and the new diagram-only pop-out body — single source, no duplication. The
  lens/popup script is a separate module (`flow-map-panel-zoom-script.ts`) that reuses a
  `window.__fmSend` bridge exposed by the main panel script, because `acquireVsCodeApi()` may be
  called only once per webview. Pop-out is a second `WebviewPanel` kept in sync on refresh and
  disposed on deactivate.
- **Error boundary.** The double-click handler wraps `JSON.parse(data-detail)` in try/catch so a
  malformed attribute can never throw out of the listener. Missing-element guards (`if (!svg)`,
  `if (!scroll)`) keep the lens inert when the diagram is absent (e.g. empty session).
- **Performance.** Per-node `data-detail` JSON is small (a node has few issues) and only on the
  webview SVG, never the saved Markdown (which uses Mermaid). Canvas width is padded only when a
  back edge exists.
- **Docs.** New/extended file-doc headers on `flow-map-panel-zoom-script.ts`; WHY comments on the
  nav-stack, depth-exclusion, label offset, back-edge id namespace, and the zoom-model rationale.
- **Refactoring.** No out-of-scope cleanups taken; stayed within the flow-map surface.

### Testing validation
**A. Audit of existing tests.** Grepped `src/test` for every changed symbol/string
(`renderSvg`, `renderMermaid`, `buildGraph`, `buildFlowMapBody`, `buildFlowDiagramBody`,
`flowDiagramHtml`, `recordTransition`, `data-zoom`, `diagram-scroll`, `fm-back`, `flowMapScript`,
`flowMapZoomScript`, `__fmSend`). Only `src/test/modules/flow-map/flow-map.test.ts` matched. The
FIXTURE now legitimately produces a back edge (Contact View→Home re-entry); audited the existing
assertions — `R2 visits=2/2` and `no self-loops` still hold (back edge is not a self-loop), the
inline-leaf and crash-edge assertions are unaffected, and the SVG rect-count test counts `<rect>`
(back edge renders `<path>`, nodes unchanged). The viewer-toolbar tests reference the log viewer's
flow-map *button* (a surface I did not touch).

**B. New tests.** Added a `back navigation (return to caller)` suite (deep return emits a back edge;
immediate re-entry emits a back edge; svg back marker + `data-detail`; mermaid ↩) and two `S3`
render tests (diagram-scroll container + pop-out control present in the report; diagram-only
pop-out body has no nested pop-out and no tables).

**Commands run:**
- `npm run check-types` → clean.
- `npm run lint` → 0 errors; 9 pre-existing warnings, all in untouched files (none in changed files).
- `npm run compile-tests` then `npm run test:file -- out/test/modules/flow-map/flow-map.test.js`
  → **29 passing**.
- `npm run compile` (full production build) → NLS verify aligned (487 keys, 11 files), webview
  incoming + host-outbound catalogs match, command list matches, dist bundle built (4.64 MiB,
  under ceiling).

### Localization
DEFAULT-variant Section 5 is Flutter-ARB specific → **SKIPPED [B-NOT-IN-SCOPE]**. Extension l10n
WAS handled: 17 new English keys added to `src/l10n/strings-b.ts` (`flowMap.popOutBtn` and the
`flowMap.detail*` popup labels), injected into the client as a localized label map so the popup is
translation-ready (no hardcoded user-facing strings in the webview JS). `verify-nls` passed as part
of compile. Translation of the new keys is a separate pipeline on its own cadence (not run here).

### Project maintenance
- CHANGELOG: `[Unreleased]` updated with Added (node detail, pop-out, back arrows) + Changed
  (zoom/scroll/center, label move, splitter).
- README: added Interactive-diagram and Return-navigation bullets under the Flow Map section.
- Plan 056 status line updated to mark S3 shipped (plan stays ACTIVE — live log-filtering still
  proposed, so it is not archived).
- `package.json` / lockfile: unchanged (no release/dep change).
- LAUNCH_TEST: `docs/launch/LAUNCH_TEST.md` does not exist in this repo → manual-test steps live in
  the chat `## What to test` block and this report.
- Bug archive: **No bug archive — task did not close a bugs/*.md file.**

### Files changed
- `src/modules/flow-map/flow-map-model.ts` — `FlowEdge.back?`.
- `src/modules/flow-map/flow-map-builder.ts` — nav-stack, `recordTransition`, `upsertEdge` inline,
  back-edge emission, seed stack.
- `src/modules/flow-map/flow-map-svg.ts` — back-edge render + marker, depth exclusion, edge label
  offset, per-node `data-detail`, canvas right-pad for the back bulge.
- `src/modules/flow-map/flow-map-mermaid.ts` — back-edge ↩ rendering.
- `src/modules/flow-map/flow-map-html.ts` — `flowDiagramHtml`/`buildFlowDiagramBody`, scroll
  wrapper, pop-out button, legend mentions double-click.
- `src/ui/panels/flow-map-panel.ts` — include zoom script, pop-out panel + `popOutFlow` handler,
  pop-out refresh-sync + dispose.
- `src/ui/panels/flow-map-panel-script.ts` — expose `window.__fmSend`, drop the old viewBox lens.
- `src/ui/panels/flow-map-panel-zoom-script.ts` — **new**: CSS-size zoom/pan, fit/center,
  center-fault scroll, pop-out wiring, double-click detail popup.
- `src/ui/panels/flow-map-panel-styles.ts` — `.diagram-scroll`/centering, `.diagram-only`,
  `.fmd-*` modal styles, splitter 20px floors.
- `src/l10n/strings-b.ts` — 17 new flow-map keys.
- `src/test/modules/flow-map/flow-map.test.ts` — new back-nav + S3 suites.
- `CHANGELOG.md`, `README.md`, `plans/056_plan-session-flow-map.md` — docs.

### Outstanding
Webview runtime behavior (zoom/pan/scroll/center/popup/pop-out pointer interaction) renders only in
the Extension Host — the unit tests assert the generated HTML/SVG/Mermaid strings, not live
pointer behavior. Device/F5 verification pending (see `## What to test`).
