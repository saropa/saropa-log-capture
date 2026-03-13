# Roadmap

Future work only. Completed work is in [CHANGELOG.md](CHANGELOG.md) and `bugs/history/`. *Updated: 2026-03-13.*

---

## 1. Core product features

| Feature | Description |
|---------|-------------|
| Zero-config Debug Console persistence | Auto-save debug output with no setup; only extension that does this. |
| Session-based log persistence | Logs saved per session; browse, search, and correlate across runs. |
| Rich log viewer | Filters, search, integrations, timeline, context popover — not just viewing. |

---

## 2. Roadmap (by effort and wow factor)

Single table: **Wow** (High → Medium → Low), then **Effort** (low to high). Quick wins at the top.****

| Wow | Effort | Feature | Description | Plan |
|-----|--------|---------|-------------|------|
| High | 1–2 days | Viewer / options polish | Export in Options → Actions; "Presets" → "Quick Filters" copy | [027](bugs/027_plan-viewer-options-polish.md) |
| High | 2–4 days | Smart bookmarks | Auto-suggest bookmark at first error per run | [038](bugs/038_plan-smart-bookmarks.md) |
| High | 2–4 days | Voice / TTS | Read selected lines or errors aloud | [036](bugs/036_plan-voice-tts.md) |
| High | 3–5 days | Error rate over time | Chart: errors/minute over session | [030](bugs/030_plan-error-rate-over-time.md) |
****| High | 5–8 days | Regression hints | "This error pattern appeared after commit X" | [034](bugs/034_plan-regression-hints.md) |
| High | 5–8 days (MVP) | Live collaboration | Share session; others see same log and scroll position | [033](bugs/033_plan-live-collaboration.md) |
| Medium | 3–5 days | Bidirectional sync | Reload/merge when log file is modified externally | [039](bugs/039_plan-bidirectional-sync.md) |
| Medium | 3–5 days | Export Insights summary | CSV/JSON of recurring errors + hot files | [032](bugs/032_plan-export-insights-summary.md) |
| Medium | 3–5 days | Lazy load session list | Virtualize or paginate for 100+ sessions | [028](bugs/028_plan-lazy-load-session-list.md) |
| Medium | 5–8 days | Log diff from Git | Compare session to previous commit | [035](bugs/035_plan-log-diff-from-git.md) |
| Medium | 7–10 days | Session comparison (3-way) | Compare three sessions side by side | [031](bugs/031_plan-session-comparison-three-way.md) |
| Medium | 10–14 days | Noise Learning | Learn from dismissals, suggest exclusion rules | [025](bugs/025_plan-noise-learning.md) |
| Low | 5–8 days | Incremental index for search | "Search in all logs" with scalable index | [029](bugs/029_plan-incremental-index-search.md) |
| Low | Variable | Integration adapters | database, externalLogs, http, browser, security — full implementation from specs | [001](bugs/001_integration-specs-index.md) · [009](bugs/009_integration-spec-application-file-logs.md)–[013](bugs/013_integration-spec-security-audit-logs.md) |

See [bugs/019_cohesion-plans-index.md](bugs/019_cohesion-plans-index.md) for cohesion/intelligence index.

---

## 3. Known issues

| Issue | Location | Severity | Plan |
|-------|----------|----------|------|
| No explicit accessibility (a11y) | webview UI | Medium | [028 a11y](bugs/028_plan-webview-accessibility.md) |

*Addressed: CSP unsafe-inline ([027](bugs/history/20260313/027_plan-csp-remove-unsafe-inline.md)), Marketplace URL ([029](bugs/history/20260313/029_plan-marketplace-url-config.md)).*

---

*For changelog, see [CHANGELOG.md](CHANGELOG.md). For code standards, see [CONTRIBUTING.md](CONTRIBUTING.md).*
