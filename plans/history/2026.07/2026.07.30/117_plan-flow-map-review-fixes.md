# Plan 117 — Flow Map review fixes (13 items)

**Status:** Implemented (2026-07-30) — pending F5 manual pass
**Commits:** A `c0630bbf` · B `ef829145` · C `6a253bc8` · D `b7b95ce6` · E `a937fb8f`
**Origin:** Code review of the flow-map module (parser → breadcrumbs → issues → builder → SVG → HTML).
**Scope:** `src/modules/flow-map/*`, `src/ui/panels/flow-map-panel*`, l10n strings, two new settings.

## Phase A — parser/builder correctness

1. **Worst slow query loses its time.** `appendWorstSlow()` pushes `tsMs: 0`, so
   `attachIssues()` (which skips `tsMs <= 0`) never badges a node and the row sorts to the
   top with an empty clock. Fix: carry `tsMs`/`clock` on `SlowQuery` from the matched line.
2. **Edge dwell labels show the node's TOTAL dwell.** `edgeLabel()` prints
   `from.node.dwellMs` (accumulated across all visits). Fix: accumulate per-edge dwell at
   transition time (`FlowEdge.dwellMs`), label from that.
3. **Only the first crash is detected.** `detectCrash()` = one `findIndex`. Fix:
   `detectCrashes()` finds every exception banner; `ParsedLog.crashes: CrashInfo[]`
   (keep `crash` = first for existing consumers). Builder places each crash node, joining
   the `from` edge by time-window (final `currentKey` is wrong for mid-session crashes).
   Dwell close-out uses max(last event, last crash).
4. **Forward re-entry misread as back-nav.** `recordTransition` uses `indexOf` (first
   occurrence on the stack) → over-pops when a key appears twice. Fix: `lastIndexOf`
   (nearest occurrence, minimal pop).
5. **Warning dedup discards frequency.** Keep category dedup but count repeats into the
   retained row (`detail ×N`).
6. **`App Startup` lifecycle events are parsed then dropped.** Fix: a mid-session Startup
   closes the current node's dwell, resets the nav stack to launch, and increments the
   launch node's visits — hot restarts become visible and repeated Home entries get their
   explanation. Session-info gains a "Restarts" row when > 0.

## Phase B — SVG rendering polish

7. **Hard-coded dark hex palette.** Move all node/edge/text fills to CSS classes styled in
   `flow-map-panel-styles.ts` with semantic tokens (`--status-good`, `--status-bad`,
   `--accent-info`, `--accent-opinionated`, `--surface-1`, `--muted`) so light themes work.
8. **Visit badge shows ① on single visits.** Render the corner badge only when visits ≥ 2.
9. **Multiple back edges overlap.** Stagger each back edge's bulge by index.
10. **Labels clip at a flat 30 chars.** Clip per line role (title vs detail font sizes).

## Phase C — l10n

11. **Localize the report chrome.** Section titles, table headers, session-info labels,
    legend tooltip, and hover titles in `flow-map-html.ts` move to `t()` keys.
    English source keys only; MT is operator-run later.

## Phase D — configurable capture patterns

12. **Heuristic matchers are one app's dialect.** New settings (read fresh per report):
    - `saropaLogCapture.flowMap.customBreadcrumbs`: array of
      `{ pattern, kind?: nav|action|viewed|handoff, nodeKind?, label? }` — `label`
      supports `$1` capture templates, default `$1`.
    - `saropaLogCapture.flowMap.customIssues`: array of
      `{ pattern, category, severity?: warn|perf|error, detail? }`.
    Compiled in the command layer, threaded into `parseLog` via an options bag so the
    parser stays pure. Invalid regexes are skipped non-fatally. Built-in matchers remain.

## Phase E — screenshots on the map

13. **Join captured screenshots to the map.** `.screenshots.json` sidecar entries carry
    `logLine` anchors; join each to the nearest preceding node-entry event and render a
    "Screenshots" section (thumbnail grid grouped by screen, click reveals the log line).
    Thumbnails are data URIs (CSP gains `img-src data:`), capped to bound webview weight.
    Join logic is a pure module for node-test coverage.

## Gates

Per phase: check-types, lint, compile, `node --test` on flow-map tests, changelog entry,
atomic commit. F5 manual pass at the end.

## Finish Report (2026-07-30)

All 13 items shipped across five commits (A `c0630bbf`, B `ef829145`, C `6a253bc8`,
D `b7b95ce6`, E `a937fb8f`) plus a post-review hardening commit.

**Defects fixed (phase A).** The worst slow query was promoted with `tsMs: 0`, so the
builder's issue overlay (which skips non-positive timestamps) never badged a node and the
row sorted above the timeline with an empty clock; it now carries the matched line's real
time. Diagram edge labels printed the source node's TOTAL dwell across all visits;
`FlowEdge.dwellMs` now accumulates per-transition dwell at record time. Crash detection
stopped at the first exception banner; `detectCrashes` walks every banner, `ParsedLog`
carries `crashes[]` (with `crash` kept as a first-crash alias), and each crash's inferred
edge anchors to the innermost screen/tab whose dwell window contains its timestamp — the
final `currentKey` is only correct for the last crash. The nav-stack return-pop used
`indexOf`, over-popping when a key sat on the stack twice; `lastIndexOf` pops to the
nearest occurrence. Warning dedup kept only the first occurrence per category; a count map
now appends `×N`. `App Startup` lifecycle events were parsed then dropped; a mid-session
startup now closes dwell, resets the stack to the launch node, and increments its visits.

**Rendering (phase B).** The SVG's baked dark-only hex palette moved to CSS classes
(`fm-p-*`, `fm-e-*`, `fm-badge*`, marker heads) styled with semantic tokens in
`flow-map-panel-styles.ts`, so light themes render correctly. The visit badge renders only
for revisits; back-edge bulges stagger per edge; node-line clipping is per-role (title vs
detail font widths). The builder's edge-id NUL-byte separators were rewritten as visible
`\0` escapes (identical runtime strings) so tooling stops classifying the file as binary.

**Localization (phase C).** The report chrome (section titles, table headers, session-info
labels, hover titles, legend tooltip, kind labels) resolves through `t()` with 43 new
`flowMap.*` keys in the new `strings-flow-map.ts` (split from `strings-b.ts` at the
300-line budget). The saved markdown report intentionally stays English.

**Extensibility (phase D).** `saropaLogCapture.flowMap.customBreadcrumbs` and
`.customIssues` let any project map its own log dialect onto the map. Patterns compile in
the pure `flow-map-custom-patterns.ts` (per-entry validation, invalid regexes skipped,
never throws) and are consulted only after every built-in matcher misses. Documented in
`plans/guides/configuration.md`.

**Screenshots (phase E).** The `.screenshots.json` sidecar (plan 114) joins to the map:
each capture pairs with the last nav/reached event at or before its log line (pure join in
`flow-map-screenshots.ts`), renders as a data-URI thumbnail (capped at 12, unreadable PNGs
skipped non-fatally) in a collapsible Screenshots section, and clicks through to its log
line. Main-report CSP gained `img-src data:`; the diagram pop-out CSP is unchanged.

**Post-review hardening.** A widget-less crash could steal the NEXT crash's error-causing
widget because the per-crash scan sliced to end-of-log; the scan now bounds at the next
exception banner (regression-tested). Custom patterns scan at most the first 500 chars of a
line to bound catastrophic-backtracking on user-supplied regexes. The two NLS setting
titles were shortened to labels (they duplicated the descriptions verbatim across 11
locale files). The `Crash` category reservation is documented in the custom-patterns
module.

**Known follow-ups (not blockers).** Node dwell windows are single `firstTsMs`/`lastTsMs`
fields, not per-visit intervals — a crash during a gap between two visits of the same
screen can mis-anchor; multi-crash support leans on this pre-existing conflation.
`NODE_CREATING_KINDS` is duplicated between the builder and the screenshot join (two uses;
extract on the third). Verification: full 12-step compile green (bundle 5.28 MiB), 77
tests across six flow-map suites passing. The F5 Extension Development Host manual pass
remains outstanding.
