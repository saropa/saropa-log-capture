# 110 — Trouble Mode dashboard v2: side rail layout

## Status: Shipped — Stages 1–5. See Finish Report below.

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

## Open questions — resolved

1. **Resizable rail divider.** DEFERRED as recommended. The fixed
   `clamp(320px, 40%, 560px)` width shipped; a drag handle (precedent:
   `viewer-scrollbar-minimap-resize.ts`) is only worth adding if that width proves wrong
   in use.
2. **Narrow/wide breakpoint.** Shipped at 700px of `#log-content-wrapper` width
   (`TROUBLE_RAIL_MIN_WIDTH`, `viewer-trouble-detail.ts`). Still to confirm against real
   sidebar widths in an F5 pass.
3. **Cache timestamp availability.** ANSWERED: yes, no schema change needed.
   `writeCachedIssues` has always stamped `cachedAt: Date.now()` into `issues.json`
   (`crashlytics-io.ts`); `readCachedIssues` simply discarded it. A new
   `readCachedIssuesWithMeta()` returns both, and `readCachedIssues` now delegates to it.

## Finish Report (2026-07-10)

All five stages built and verified through the 12-gate `npm run compile` chain plus the
touched unit tests. The unverified surface is the F5 Extension-Host visual render.

### What shipped

- **Stage 1 — side rail.** `#log-content-wrapper` was already a flex row whose
  `.log-content-clip` child is `flex: 1 1 0%; min-width: 0`, so the wide layout needed no
  new container: `.trouble-detail` becomes a static flex item at
  `width: clamp(320px, 40%, 560px)` under `body.slc-trouble-rail-wide`, and the feed
  shrinks beside it. The original `position: absolute; inset: 0` rules remain as the
  narrow fallback below 700px of wrapper width. Rail chrome rebuilt: severity-colored
  header cap driven by the same `item.level` the feed filters on, two-line clamped title,
  an actions row, and a **Reveal in log** button (`scrollToLineNumber` on the row's
  `viewerLineIndex`, which is a different coordinate space from the host's
  `sourceLineNo`). `aria-live="polite"` on both rail slots.
- **Stage 2 — Crashlytics detail into the rail.** `cdActiveContainer(useRail)` is the one
  writer of `cpDetailEl`, so the click handlers, the `crashlyticsDetailReady` route, and
  the three async enrichers follow the active container automatically. Band rows reach it
  through two exposed bridges, `window.slcOpenCrashlyticsDetailInRail` and
  `window.slcCloseCrashlyticsDetail`, which run the SAME `cdOpenDetail` path as a
  sidebar-list click — that is what sets `cpDetailIssueId` and retires the KNOWN
  LIMITATION (band-opened details had been silently dropping the "In your project",
  "Seen in your logs", and device-state panels). Selected band row highlighted; one
  Escape / one × closes the rail in either mode (`closeTroubleRailAnyMode`).
- **Stage 3 — informative skeleton, error, freshness.** `cdSkeletonHtml` paints the issue
  header synchronously from the `data-*` meta the row already carries (severity dot,
  subtitle, events/users, state, version range); only the stack shimmers. Failure now
  renders a **Try again** button (`.cd-retry`) that re-issues the fetch from the stored
  meta. The three hardcoded English strings in `crashlytics-detail-handler.ts` moved to
  `t()` keys. The freshness label ships in the band head (single surface, Stage 5) rather
  than duplicated in a rail header that is hidden in Crashlytics mode.
- **Stage 4 — chart readability.** Legend chips with per-level totals in the pane head
  (costing the feed no vertical space), start/end clock labels, a peak-count label, a 3px
  minimum bar, and a translucent full-height band marking the window that holds the row
  open in the rail. Labels are HTML, never SVG `<text>`: the strip is drawn with
  `preserveAspectRatio="none"`, which would stretch glyphs. Selection is stored as a
  timestamp, not a bucket key, because bucket size changes with the interval setting.
- **Stage 5 — band compaction.** Top five rows inline, `All N issues` link into the
  Crashlytics panel, and a cache-age label. `handleTroubleCrashlyticsRequest` now posts
  `total` (non-archived count before the row cap) and `cachedAt` alongside `rows`.

### Deviations from this plan (deliberate, with reasons)

- **Container query rejected for the wide/narrow switch.** The plan preferred a container
  query on `#log-content-wrapper` over a JS width check. `container-type: inline-size`
  makes the element a containment context and silently re-parents the containing block of
  its absolutely positioned children (minimap, jump buttons, goto-line, replay bar). A
  class toggle behind one ResizeObserver costs nothing and changes nothing else. The
  wrapper's own width does not change when the rail opens (only `.log-content-clip`
  shrinks), so the measurement cannot oscillate across the breakpoint.
- **Leading empty windows were already trimmed.** Review finding 4 claimed the chart
  spreads bursts across mostly-empty space. `buildTroubleChartBuckets` already started the
  rendered span at `minKey`, the first window holding an event; the 180-bucket cap only
  bounds how far back a long session reaches. No change was made, and the comment now
  states this so the claim is not re-filed.
- **Legend totals sum the RENDERED bins, not `allLines`.** Counting every matching line
  would let the legend claim errors the capped window never draws. Regression-tested.
- **Cache-freshness line placed in the band head only.** The plan mentioned it for both
  the rail header (Stage 3) and the band (Stage 5). The rail header is hidden while a
  Crashlytics detail is showing, so a freshness line there would be invisible exactly when
  it matters.
- **Two files extracted to stay under the 300-line limit.** Giving the detail a second
  render container pushed `viewer-crashlytics-interactions-script.ts` to 312 lines. The
  stack-frame context menu (`viewer-crashlytics-frame-menu-script.ts`) and the sidebar
  list controls (`viewer-crashlytics-filters-script.ts`) moved out unchanged, inlined back
  into the same panel IIFE so shared scope is preserved.

### Verification

- `npm run compile` — all 12 gates pass (typecheck, lint, NLS parity + coverage, three
  catalog checks, `verify:l10n-keys` against 2408 keys, bundle, dist-size 5.06 MiB).
- `npx mocha --ui tdd --spec out/test/ui/viewer-trouble-chart.test.js --spec
  out/test/modules/crashlytics/trouble-crashlytics-rows.test.js` — 10 passing. Four new
  chart tests pin the legend totals (including the capped-window exclusion) and
  `setTroubleChartSelection`.
- Lint on the touched files is clean. The two warnings that remain in this area
  (`handleTroubleDetail` has 5 parameters; several files over the line limit) are
  pre-existing and in files this work did not modify.

## Review pass (2026-07-10)

A structured read-only review of the shipped diff found no blocking bug, no shared-scope
collision among the new page-global names, no `item.height` write, and no broken test
assertion. Three behavioral defects were reported; all three were fixed.

### Fixed

- **Stale detail render on rapid issue switching.** `crashlyticsDetailReady`
  (`viewer-crashlytics-panel.ts`) wrote `cpDetailEl.innerHTML` with no issue-id guard,
  while the three async enrichers had always gated on `cpDetailIssueId`. A slow fetch for
  issue A landing after the user opened issue B overwrote B's detail with A's stack, with
  every other panel on screen still describing B. The defect predates this plan — the
  single-container code had the same gap — but the side rail plus the crash-issues band
  make switching issues a routine gesture, so the exposure changed from theoretical to
  everyday. A one-line `if (e.data.issueId && e.data.issueId !== cpDetailIssueId) return;`
  closes it. Regression risk is nil: the host echoes `issueId` on every reply, and the
  guard is skipped when it is absent.
- **Sidebar close tore down an unrelated rail detail.** `closeCrashlyticsPanel` called
  `closeIssueDetail()` unconditionally, on the assumption that the in-viewer detail always
  belongs to that panel. A detail opened from the crash-issues band lives in the side rail
  and does not. Guarded on `!cdRailActive`, which is true only for band-opened details
  because panel-list clicks always render into the full-area container.
- **Chart window marker survived a rail mode switch.** Opening a crash issue while a
  feed-row report was open left the severity chart marking the previous report's window. A
  crash issue is a cross-session aggregate with no window, so `cdOpenDetail` now clears the
  mark before switching the rail into Crashlytics mode.

### Accepted, not changed

`buildMarkdown`'s `'Crashlytics issue'` heading and the panel's
`cpDetailTitle = e.data.title || 'Issue'` remain literal English. Both are fallbacks in
copy-report Markdown and a GitHub issue title — export payloads, not rendered UI — and the
host always supplies a real title on the path that reaches them.

### Test coverage added by the review

The review named the band's Stage 5 composition as untested.
`viewer-trouble-crashlytics-band.test.ts` now pins the five-row inline cap, that the
"All N issues" link reports the host's `total` rather than the number of rows posted (they
differ whenever the host's own 15-row cap bites), the absolute-time freshness label and its
unstamped-cache fallback, and that a cold cache hides the band rather than rendering an
empty shell. Its `vt` stub resolves against the real `strings-webview.ts` catalog and
asserts each key exists, so a key deleted from the catalog fails the test instead of
shipping as raw-key text in the UI.

Still uncovered by automated tests: the rail open/close routing, the loading skeleton, and
the retry path. All three are DOM-and-message-plumbing surfaces whose verification is the
F5 Extension-Host pass.
