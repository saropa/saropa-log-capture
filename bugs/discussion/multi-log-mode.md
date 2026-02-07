# Multi-Log Mode — Cross-Session Viewing

## Vision

Enable users to relate multiple log sessions together — tracking a bug across sessions, building analysis reports, or reviewing a sequence of debug runs as a continuous timeline.

## Current Architecture

| Component | State |
|-----------|-------|
| Session adjacency (prev/next) | **Implemented** — `getAdjacentSessions()` in session-history-provider |
| Top-of-scroll detection | Only bottom detection exists (~30px threshold) |
| Prepend lines above | Viewer only appends; prefix sums assume append-only |
| Session boundary markers | Markers exist but only for within-session events |
| Multi-file scroll memory | Tracks scroll per single filename, not composite views |

## Implementation Roadmap

### Stage 1: Quick Nav (Low Effort) — DONE

Added **Previous Session / Next Session** bar to the viewer. One click loads the adjacent session (by mtime). Follows the split-nav breadcrumb pattern.

- `viewer-session-nav.ts` — client-side JS
- `getAdjacentSessions()` — finds prev/next across split groups
- Navigation hides during live capture, re-appears on session end
- Shows "Session N of M" with disabled buttons at boundaries

### Stage 2: Concatenated View (Medium Effort)

A command that loads N selected sessions into the viewer as one stream with session-boundary markers. Load all at once (no scroll-triggered loading), reuse existing batch-load pipeline.

- Avoids the hard prepend/scroll-rebasing problem
- Users pick sessions from a multi-select quick pick
- Visual separator markers between sessions
- Shared search/filter across all loaded sessions

### Stage 3: Full Endless Scroll (High Effort)

Seamlessly load next/prev sessions on scroll. Only worth pursuing if users actively request it after Stages 1-2.

**Why it's hard:**
- Prepending breaks virtual scrolling — prefix-sum array, scroll position, and trim logic all assume append-only. Prepending requires rebasing every offset and adjusting `scrollTop` to prevent viewport jumping
- 50K line limit conflicts — trim logic would need to work in session-sized chunks from both ends
- Mixed live + historical — active recording session + upward historical loading = two competing data flows
- Split files add a dimension — "previous session" might mean "last part of the previous session's split files"
- File loading is batch-synchronous — would need true on-demand loading without blocking scroll

### Stage 4: Session Groups & Analysis

- Named session groups ("Bug #42 investigation")
- Cross-session search and diff
- Timeline view showing session durations and gaps
- Export grouped sessions as a single report
- Annotations that reference lines across sessions

## Use Cases

1. **Bug tracking** — Step through consecutive debug runs to see how output changes after each code fix
2. **Regression detection** — Compare today's session output with yesterday's
3. **Deployment verification** — Review pre-deploy test run → deploy logs → post-deploy test run in sequence
4. **Onboarding** — Walk through a series of example sessions
5. **Analysis reports** — Combine relevant sessions into a single reviewable artifact
