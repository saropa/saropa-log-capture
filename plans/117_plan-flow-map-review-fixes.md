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
