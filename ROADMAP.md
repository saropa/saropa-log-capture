# Roadmap

Future work only. Completed work is in [CHANGELOG.md](CHANGELOG.md) and [plans/history/](plans/history/). *Updated: 2026-05-13.*

---

## 1. Core product features

| Feature | Description |
|---------|-------------|
| Zero-config Debug Console persistence | Auto-save debug output with no setup; only extension that does this. |
| Session-based log persistence | Logs saved per session; browse, search, and correlate across runs. |
| Rich log viewer | Filters, search, integrations, timeline, context popover — not just viewing. |

---

## 2. Roadmap (by effort and wow factor)

Single table: **Wow** (High → Medium → Low), then **Effort** (Low → Medium → High). Quick wins at the top.

| Wow | Effort | Feature | Description | Plan |
|-----|--------|---------|-------------|------|
| High | Low | Voice / TTS | Read selected lines or errors aloud | [036](plans/deferred/036_plan-voice-tts.md) (deferred) |
| High | Medium | Live collaboration | Share session; others see same log and scroll position | [033](plans/033_plan-live-collaboration.md) |
| Medium | Low | Docker polish | `includeInspect` sidecar; `--until` on logs | [007](plans/007_plan-docker-inspect-and-until.md) |
| Medium | Low | Bidirectional sync | Reload/merge when log file is modified externally | [039](plans/039_plan-bidirectional-sync.md) |
| Medium | Medium | Log diff from Git | Compare session to previous commit | [035](plans/035_plan-log-diff-from-git.md) |
| Medium | Medium | Session comparison (3-way) | Compare three sessions side by side | [031](plans/031_plan-session-comparison-three-way.md) |
| Low | Medium | Incremental index for search | "Search in all logs" with scalable index | [029](plans/029_plan-incremental-index-search.md) |
| High | Medium | Structured line parsing | Auto-detect log formats (logcat, syslog, Python, etc.), extract and strip prefix metadata (timestamp, PID, TID, level, tag), click-to-filter, tooltips | [047](plans/047_plan-structured-line-parsing.md) |
| High | Medium | Session flow map | Directed screen-transition diagram — boxes per screen/tab/dialog, one-way counted arrows, dwell times, crash overlay. Mermaid export now, interactive webview graph next. Consumes [052](plans/052_plan-semantic-timeline-capture-and-signal-expansion.md) nav events | [056](plans/056_plan-session-flow-map.md) |
| Low | High | Integration adapters | database, externalLogs, http, browser, security — full implementation from specs | [001](plans/integrations/001_integration-specs-index.md) · [009](plans/integrations/009_integration-spec-application-file-logs.md)–[013](plans/integrations/013_integration-spec-security-audit-logs.md) |

### Unscored — needs Wow/Effort assignment

Open plans currently in [plans/](plans/) that are not yet scored against the roadmap. Listed in numeric order; assign Wow/Effort before merging into the main table above.

| Feature | Description | Plan |
|---------|-------------|------|
| Toolbar filter drawer | Consolidated drawer UX for viewer filters | [041](plans/041_plan-toolbar-filter-drawer.md) |
| SQL UX overhaul | Rework Drift SQL surfaces in the viewer | [043](plans/043_plan-sql-ux-overhaul.md) |
| Perf line signal detection | Detect performance-related signal lines | [048](plans/048_plan-perf-line-signal-detection.md) |
| Recurring device-other demotion | Demote recurring noise from device-other tier | [050](plans/050_plan-warning-recurring-device-other-demotion.md) |
| Structured file modes | Alternate viewing modes for structured log files | [051](plans/051_plan-structured-file-modes.md) |
| Semantic timeline capture | Capture and broaden signal expansion in the timeline | [052](plans/052_plan-semantic-timeline-capture-and-signal-expansion.md) |
| Investigate missing debug console lines | Bug: lines dropped from debug console capture | [102](plans/102_investigate-missing-debug-console-lines.md) |
| Pubspec vibrancy report hardening | Harden the pubspec vibrancy report path | [103](plans/103_plan-pubspec-vibrancy-report-hardening.md) |
| Static ORM code analysis | Static analysis of ORM usage | [DB_12](plans/DB_12_static-orm-code-analysis.md) |
| DB timestamp burst detector | Detect burst patterns in DB timestamps | [DB_16](plans/DB_16_db-timestamp-burst-detector.md) |

---

## 3. Known issues

| Issue | Location | Severity | Plan |
|-------|----------|----------|------|
| No explicit accessibility (a11y) | webview UI | Medium | [028 a11y](plans/028_plan-webview-accessibility.md) |

---

*For changelog, see [CHANGELOG.md](CHANGELOG.md). For code standards, see [CONTRIBUTING.md](CONTRIBUTING.md).*
