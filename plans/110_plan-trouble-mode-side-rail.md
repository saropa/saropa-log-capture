# 110 — Trouble Mode dashboard v2: side rail layout

## Status: Open — not started

## Problem (UX review, 2026-07-10)

Trouble Mode's dashboard stages (severity chart, crash-issues band, detail pane, Copy
Report) shipped functionally correct but with a layout model that makes the mode hard to
use. Review findings, ranked:

1. **Both detail surfaces replace the log instead of opening beside it.** The trouble
   detail is a full overlay of the feed (`viewer-styles-trouble-detail.ts` —
   `position: absolute; inset: 0`), and the Crashlytics issue detail hides the entire
   `#log-content-wrapper` (`viewer-trouble-crashlytics.ts` `openTroubleCrashlyticsDetail`).
   The v1 plan's Stage 4 heading was "Detail report (right pane)"; only the narrow-sidebar
   overlay fallback was built, and it was applied to every viewport including the wide
   pop-out. Triage means comparing the log against the detail — a detail that hides the
   log defeats the mode.
2. **The Crashlytics loading view discards information it already holds.** Every band row
   carries title, subtitle, events, users, fatal/ANR kind, and first/last version in
   `data-*` attributes; the click handler reads all of them and then renders only
   "Loading issue…" until the network returns. A full viewport showing one sentence.
3. **Vertical stacking starves the feed.** Chart (~90px) + band (up to ~160px) push the
   log into the bottom third of the viewport. In Trouble Mode the log is the product.
4. **The chart is decorative, not readable.** No time axis, no legend, no count labels;
   single events render as 1px dashes; the 180-bucket contiguous window spreads a few
   bursts across mostly-empty space. It cannot answer "when did it go wrong and how badly".
5. **The trouble detail is visually indistinguishable from the feed.** Its evidence block
   renders numbered monospace log lines, so opening it reads as "the log jumped", not
   "a report opened". Thin header, truncated title, no severity accent.
6. **No wayfinding or state.** The clicked band row gets no selected highlight; Escape
   closes the trouble detail but not the Crashlytics detail; a band-opened Crashlytics
   detail silently drops the enrichment panels ("In your project", "Seen in your logs",
   device states) because the panel's private `cpDetailIssueId` is never set — recorded
   as a KNOWN LIMITATION in `viewer-trouble-crashlytics.ts`.
7. **Hardcoded English** in `crashlytics-detail-handler.ts` ("Could not load this issue.",
   "No stack trace available for this issue.", fallback title "Issue") bypasses `t()`.

## Prior art and constraints

- **v1 plan (archived):** `plans/history/2026.07/2026.07.09/PLAN_TROUBLE_MODE_dashboard.md`.
  Its Open Question 4 already recorded the layout answer: sidebar = stacked + overlay;
  wide viewport / pop-out = side-by-side. The wide layout was never built.
- **Resize machinery exists:** `viewer-script.ts` `onLogOrWrapResize` (ResizeObserver on
  the log element + `window.resize` fallback) re-lays-out on width change. Word-wrap mode
  (`toggleWrap`, `viewer-script.ts:276`) makes row heights width-dependent, so opening or
  closing the rail MUST flow through this path — verify the ResizeObserver fires when the
  rail changes the log element's width; if not, call the handler explicitly.
- **Height contract:** layout change only. No script writes `item.height`;
  `calcItemHeight` stays the single authority (architecture contract).
- **Crashlytics detail pipeline:** `openIssueDetail` → `fetchCrashlyticsDetail` →
  `crashlyticsDetailReady` fills `#crashlytics-detail`; the async enrichers
  (`applyProjectInsights`, `applyLogCorrelation`, `applyDeviceStates`) query `cpDetailEl`
  and gate on `cpDetailIssueId` (`viewer-crashlytics-interactions-script.ts`).
- **Fences carried over from v1:** no editor-tab Crashlytics dashboard (2026-05-24 pivot);
  no new Crashlytics fetch endpoints (bug_008); no charting dependency (dist-size gate);
  machine-translation pipeline is operator-run only (new keys ship English + sync only).
- **Design tokens only** (`viewer-styles-tokens.ts`); no new tokens without the
  blast-radius gate.

## Design

Each stage is independently shippable. Stage 1 is the core fix; defects 1–3 all resolve
through it.

### Stage 1 — Side rail (feed left, detail right)

- Add a body class `slc-trouble-rail-open`, toggled by `renderTroubleDetail` /
  `closeTroubleDetail`. While set AND the wrapper is wide, `#log-content-wrapper` lays out
  as a flex row: `.log-content-clip` at `flex: 1; min-width: 0`, `#trouble-detail`
  restyled from `inset: 0` overlay to a static right column,
  `width: clamp(320px, 40%, 560px)`, full height, left hairline border.
- **Narrow fallback:** below ~700px wrapper width, keep the current full-overlay behavior
  (the v1 Open Question 4 recommendation). Prefer a container query on the wrapper over a
  viewport media query — the sidebar and pop-out are different containers in the same
  window; verify container-query support in the webview runtime first and fall back to a
  JS width check wired into `onLogOrWrapResize` if unsupported.
- Chart and band stay above; the feed remains visible at all times in wide mode.
- Escape and the × button close the rail; closing removes the body class and the feed
  reflows back to full width (through the resize path, so wrap-mode heights recalc).
- Detail visual identity, same stage (defect 5): severity-colored top accent on the rail
  header (`--accent-critical` / `--accent-warning` / `--accent-info` by level), title
  wraps to two lines instead of truncating, section headers (Fault / Evidence / Session)
  in the existing eyebrow style, and a "Reveal in log" action next to Copy Report that
  calls `scrollToLineNumber` with the detail's source line.

### Stage 2 — Crashlytics detail into the rail

- In Trouble Mode, a band click renders the issue detail into the rail, not into the
  full-area `#crashlytics-detail`. The non-trouble Crashlytics panel flow is unchanged.
- Refactor `viewer-crashlytics-interactions-script.ts` so the render target is resolved by
  one function (e.g. `cdActiveContainer()`), used by `openIssueDetail`, the
  `crashlyticsDetailReady` route, and the three `apply*` enrichers. Expose a scoped setter
  for `cpDetailIssueId` so a band-opened detail receives the enrichment panels — this
  removes the KNOWN LIMITATION comment in `viewer-trouble-crashlytics.ts`.
- The clicked band row gets a selected highlight (cleared on close); Escape closes the
  rail regardless of which detail type it shows. One rail, one close affordance.

### Stage 3 — Informative loading skeleton, error, and freshness

- On band click, render the full issue header synchronously from the `data-*` meta the
  row already carries: severity icon, wrapped title, subtitle, events/users/version
  chips, kind/state. Shimmer placeholder only where the stack section will land.
- Localized error state with a retry button. Fix defect 7: move the hardcoded English in
  `crashlytics-detail-handler.ts` into `t()` keys in the same change.
- Cache provenance line in the rail header ("cached · updated <time>"). Verify first that
  the watcher cache stores a fetch timestamp; if it does not, adding one is a small
  cache-schema addition to record in this plan before building.
- `aria-live="polite"` on the rail body so the loaded detail is announced.

### Stage 4 — Chart readability

- Trim leading empty windows: start the rendered span at the first non-empty bucket
  (keep the 180-bucket cap as the maximum, not the default width).
- Start and end time labels under the strip; a y-max count label; legend chips with
  per-level totals (error / warning / performance, token-colored).
- Minimum visible bar height 3px (currently 1px); hover highlight on the full bar group;
  a marker on the window containing the row currently open in the rail.
- All new labels via `vt()` keys in `strings-webview*.ts` (plus the `l10n.ts` sync list).

### Stage 5 — Band compaction

- Show the top 5 issues; an "All N issues" link opens the existing Crashlytics panel.
- Freshness label in the band head (same timestamp source as Stage 3).
- Net effect: the band's vertical budget drops from ~160px to ~120px and the feed gains
  the difference.

## Catalog and verification checklist (per stage, not at the end)

1. `npm run generate:webview-catalog` / `generate:host-outbound-catalog` after any
   handler or payload change — `npm run compile` verifies both.
2. Runtime strings: keys in `src/l10n/strings-webview*.ts` + the manual sync list in
   `src/l10n.ts:64-67`; English bundle sync only (never run the MT pipeline).
3. Quality gates: `check-types`, `lint`, `compile`, targeted tests
   (`npm run test:file`), F5 manual pass in BOTH the sidebar view and the pop-out panel,
   at narrow and wide widths, with word-wrap on and off (rail open/close must not
   desynchronize wrapped row heights).
4. CHANGELOG.md `[Unreleased]` entry with each shipped stage.

## Out of scope

- Editor-tab Crashlytics dashboard (fenced, 2026-05-24 pivot).
- New Crashlytics fetch paths or endpoints (bug_008 fence).
- Any charting/graphing dependency (dist-size gate).
- Running the machine-translation pipeline for new strings (operator-run only).
- Severity classifier changes.

## Open questions

1. **Resizable rail divider.** A drag handle with persisted width (the minimap resize
   handle is the precedent, `viewer-scrollbar-minimap-resize.ts`). Recommendation: defer;
   ship the fixed `clamp(320px, 40%, 560px)` width first and add the divider only if the
   fixed width proves wrong in use.
2. **Narrow/wide breakpoint.** ~700px wrapper width is the starting value; confirm
   against real sidebar widths during the F5 pass.
3. **Cache timestamp availability** for the freshness label (Stage 3/5) — verify the
   watcher cache schema before building; record the answer here.
