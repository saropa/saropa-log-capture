# Multi-Log Mode — Cross-Session Viewing

## Vision

Enable users to relate multiple log sessions together — tracking a bug across sessions, building analysis reports, or reviewing a sequence of debug runs as a continuous timeline.

## Current Architecture

| Component | State |
|-----------|-------|
| Session adjacency (prev/next) | **Implemented** — `getAdjacentSessions()` in session-history-provider |
| Top-of-scroll detection | Only bottom detection exists (~30px threshold). **Needed for Stage 3** upward session loading; not required for Stage 2 (one-shot load). |
| Prepend lines above | Viewer only appends; prefix sums assume append-only incremental updates |
| Session boundary markers | Markers exist but only for within-session events |
| Multi-file scroll memory | Tracks scroll per single filename, not composite views |

## Related plans

- **`DB_11_persistent-query-history-panel.md`** — session-scoped SQL history; cross-session history is explicitly out of scope for v1 there; multi-log concatenation may later need agreed behavior for DB rollups across boundaries.
- **`ECOSYSTEM_KNOWLEDGE_FILES.md`** — ecosystem index for other feature docs.

## Implementation Roadmap

### Stage 1: Quick Nav (Low Effort) — DONE

Added **Previous Session / Next Session** bar to the viewer. One click loads the adjacent session (by mtime). Follows the split-nav breadcrumb pattern.

- `viewer-session-nav.ts` — client-side JS
- `getAdjacentSessions()` — finds prev/next across split groups
- Navigation hides during live capture, re-appears on session end
- Shows "Session N of M" with disabled buttons at boundaries

### Stage 2: Concatenated View (Medium Effort)

A command that loads N selected sessions into the viewer as **one logical append-only stream** with session-boundary markers. **No scroll-triggered loading** — reuse the existing batch-load pipeline so virtual scroll and prefix sums stay append-only.

**Ordering**

- **Default:** oldest → newest by session mtime (timeline narrative).
- **Optional:** allow reorder in the quick-pick flow if the API supports move-up/down, or document manual re-selection order; avoid silent reverse order.

**Limits (same cap model as single-session)**

- Total lines in the composite buffer must respect the effective viewer cap (`getEffectiveViewerLines` / `maxLines` and optional `viewerMaxLines` from config — not a new magic number).
- If the combined payload would exceed the cap: **refuse with a clear message** or **load in mtime order until the cap is reached** and report which sessions were omitted (pick one behavior in implementation and document it in the command description).
- Optional: warn when estimated line count is high before loading (quick pick confirmation).

**UX**

- Users pick sessions from a multi-select quick pick.
- Visual separator markers between sessions (extend boundary-marker pattern).
- Shared search/filter across all loaded lines in the single store.

**Testing**

- Boundary markers appear between sessions; search hits in session 1 and session N.
- Cap behavior: two small sessions OK; synthetic overflow triggers chosen refuse-or-truncate policy without corrupting prefix sums or scroll.

### Stage 3: Full Endless Scroll (High Effort)

Seamlessly load next/prev sessions on scroll. Only worth pursuing if users actively request it after Stages 1–2.

**Why it's hard:**

- Prepending breaks virtual scrolling — prefix-sum array, scroll position, and trim logic all assume append-only. Prepending requires rebasing every offset and adjusting `scrollTop` to prevent viewport jumping.
- **Line cap** — same configured max as today; trim must behave coherently when data arrives from both ends (session-sized chunks or equivalent).
- Mixed live + historical — active recording session + upward historical loading = two competing data flows.
- Split files add a dimension — "previous session" might mean "last part of the previous session's split files."
- File loading is batch-synchronous — would need true on-demand loading without blocking scroll.

### Stage 4: Session Groups & Analysis

**MVP (ship first)**

- Named session groups (e.g. "Bug #42 investigation") stored as a list of session URIs + metadata.
- Command: **open group as concatenated view** (reuses Stage 2 pipeline).

**Later**

- Cross-session search and diff — align with **[DB_10](history/20260323/DB_10_session-comparison-db-diff.md)** and other DB plans before duplicating compare engines.
- Timeline view: session durations and gaps between members.
- Export grouped sessions as a single report (text/HTML/markdown — pick one).
- Annotations that reference lines across sessions.

## Use Cases

1. **Bug tracking** — Step through consecutive debug runs to see how output changes after each code fix
2. **Regression detection** — Compare today's session output with yesterday's
3. **Deployment verification** — Review pre-deploy test run → deploy logs → post-deploy test run in sequence
4. **Onboarding** — Walk through a series of example sessions
5. **Analysis reports** — Combine relevant sessions into a single reviewable artifact
