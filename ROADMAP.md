# Roadmap

Planned features for future releases. *Updated: 2026-03-12.*

---

## 1. Planned Features

### Tier 6: Feature Cohesion

Make features work together as a unified whole. See [bugs/019_cohesion-plans-index.md](bugs/019_cohesion-plans-index.md).

| # | Feature | Description | Plan | Effort |
|---|---|---|---|---|
| 100 | Context Popover | Click line → see HTTP/perf/terminal data ±5s | [022](bugs/022_plan-context-popover.md) | 4-7 days |
| 101 | Investigation Mode | Pin sessions, cross-source search, bundled export | [021](bugs/021_plan-investigation-mode.md) | 8-12 days |
| 102 | Unified Timeline | Single view showing all sources merged by timestamp | [020](bugs/020_plan-unified-timeline-view.md) | 7-10 days |

### Tier 7: Intelligence Layer

AI-powered analysis and automation. Requires Tier 6 as foundation.

| # | Feature | Description | Plan | Effort |
|---|---|---|---|---|
| 110 | AI Explain Error | Right-click → Explain with AI (VS Code Language Model API) | [023](bugs/023_plan-ai-explain-error.md) | 5-8 days |
| 111 | Auto-Correlation | Detect and highlight related events automatically | [024](bugs/024_plan-auto-correlation.md) | 10-14 days |
| 112 | Noise Learning | Learn from user dismissals, suggest filters | [025](bugs/025_plan-noise-learning.md) | 10-14 days |
| 113 | Share Investigation | Generate shareable URL for investigation | [026](bugs/026_plan-share-investigation.md) | 9-13 days |

### Completed Groundwork

Infrastructure already in place (accelerates Tier 6):
- Integration meta includes `capturedAt` and `sessionWindow` timestamps
- "Show Integration Context" menu item displays all integration data for a session
- `.slc` export/import includes integration sidecar files

### Implementation Order

1. **Context Popover** — Lowest effort, highest immediate value. Builds timestamp parsing infrastructure.
2. **Investigation Mode** — Solves cross-session problem. Adds unified search.
3. **Unified Timeline** — Full correlation visualization. Builds on 1 & 2.
4. **AI Explain Error** — Quick win after cohesion. Context Popover provides data AI needs.
5. **Auto-Correlation** — Timeline has events; add pattern matching.
6. **Noise Learning** — Track dismissals, suggest filters.
7. **Share Investigation** — Investigation Mode has model; add URL generation.

---

## 2. Future Ideas

| # | Idea | Description |
|---|------|-------------|
| 1 | Live collaboration | Share session; others see same log and scroll position |
| 2 | Regression hints | "This error pattern appeared after commit X" |
| 3 | Log diff from Git | Compare session to previous commit |
| 4 | Voice / TTS | Read selected lines or errors |
| 5 | Session replay | Replay log with simulated timing |
| 6 | Smart bookmarks | Auto-suggest at first error per run |
| 7 | Bidirectional sync | Reload/merge when log file is modified externally |

---

## 3. Enhancement Opportunities

### Performance & Scale

| Feature | Description |
|---------|-------------|
| Lazy load session list | Virtualize or paginate for 100+ sessions |
| Incremental index for search | Extend project indexer for "search in all logs" |

### Analytics & Insights

| Feature | Description |
|---------|-------------|
| Error rate over time | Chart: errors/minute over session |
| Session comparison (3-way) | Compare three sessions |
| Export Insights summary | CSV/JSON of recurring errors + hot files |

### More Integration Adapters

See [bugs/001_integration-specs-index.md](bugs/001_integration-specs-index.md) for database, HTTP/network, browser DevTools, and security audit adapters.

---

## 4. Known Issues

| Issue | Location | Severity |
|-------|----------|----------|
| CSP `unsafe-inline` in viewer | viewer-content.ts | Medium |
| No explicit accessibility (a11y) | webview UI | Medium |
| Hardcoded Marketplace URL | about-content-loader.ts | Low |

---

## 5. Competitor Positioning

| Product | Focus | vs. Saropa |
|---------|-------|------------|
| **Saropa Log Capture** | Persist Debug Console + rich viewer | Only extension that auto-saves Debug Console with zero config |
| Turbo Console Log | Automate console.log in code | No persistence |
| Log File Highlighter | Syntax highlight .log files | Viewing only |

---

*For changelog, see [CHANGELOG.md](CHANGELOG.md). For code standards, see [CONTRIBUTING.md](CONTRIBUTING.md).*
