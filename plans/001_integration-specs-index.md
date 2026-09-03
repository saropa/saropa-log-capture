# Integration adapter specs index

Implementation specs for log-capture integration adapters. Each adapter is opt-in via `saropaLogCapture.integrations.adapters`.

Folder navigation:

- Folder guide and canonical links: [README.md](README.md)
- Task ordering and rough effort: [TASK_BREAKDOWN_AND_EASE.md](TASK_BREAKDOWN_AND_EASE.md)
- Runbook for empty/missing capture logs: [010_runbook-missing-or-empty-logs.md](010_runbook-missing-or-empty-logs.md)
- Long-form design docs (background): all archived under `history/2026.06/`. Deferred items carried forward in [deferred/integration-spec-deferred-items.md](deferred/integration-spec-deferred-items.md).

Implemented adapters are marked **Done** and documented in the spec (or provider code); **Partial** and **Pending** rows link to active plans/specs.

| Adapter id | Spec | Status |
|------------|------|--------|
| `packages` | *(implemented)* — see [src/modules/integrations/providers/package-lockfile.ts](../src/modules/integrations/providers/package-lockfile.ts) | Done |
| `buildCi` | *(implemented)* — spec moved to [history/](history/) | Done |
| `git` | *(implemented)* — spec moved to [history/](history/) | Done |
| `environment` | *(implemented)* — spec moved to [history/](history/) | Done |
| `testResults` | *(implemented)* — spec moved to [history/](history/) | Done |
| `coverage` | *(implemented)* — spec moved to [history/](history/) | Done |
| `crashDumps` | *(implemented)* — spec moved to [history/](history/) | Done |
| `windowsEvents` | *(implemented)* — spec moved to [history/](history/) | Done |
| `docker` | *(implemented)* — spec moved to [history/](history/) | Done |
| `database` | *(implemented)* — spec archived to [history/2026.06/](history/2026.06/); deferred items in [deferred/integration-spec-deferred-items.md](deferred/integration-spec-deferred-items.md) | Done |
| `externalLogs` | *(implemented)* — spec archived to [history/2026.06/](history/2026.06/); deferred items in [deferred/integration-spec-deferred-items.md](deferred/integration-spec-deferred-items.md) | Done |
| `performance` | *(implemented)* — spec moved to [history/](history/) | Done |
| `http` | *(implemented)* — spec archived to [history/2026.06/](history/2026.06/); deferred items in [deferred/integration-spec-deferred-items.md](deferred/integration-spec-deferred-items.md) | Done |
| `terminal` | *(implemented)* — spec moved to [history/](history/) | Done |
| `browser` | *(implemented)* — spec moved to [history/](history/2026.06/2026.06.10/) | Done |
| `linuxLogs` | *(implemented)* — spec moved to [history/](history/) | Done |
| `security` | *(implemented)* — spec archived to [history/2026.06/](history/2026.06/); deferred items in [deferred/integration-spec-deferred-items.md](deferred/integration-spec-deferred-items.md) | Done |

**API:** [INTEGRATION_API.md](../history/INTEGRATION_API.md) — provider contract, lifecycle, performance/UX, status bar.

---

## Performance (PERF): one place (the Performance panel)

All performance-related features live in the **Performance panel** (graph icon). It is OK to flag HOT/flame/slow items in the log list (e.g. purple perf count); the full story is in the panel.

| Tab / feature | What it is | Where you see it |
|---------------|------------|------------------|
| **Current** | We scan the **current log** for PERF/jank/GC/timeout, **memory** (Flutter/Dart), and group them. | Performance panel → **Current** tab. Click a row to jump to that line. |
| **Trends** | Cross-session aggregated durations and trend (improving/degrading/stable). | Performance panel → **Trends** tab. Table + chart. |
| **Session** | System snapshot, session samples, and profiler output. | Performance panel → **Session** tab. When the Performance adapter is enabled: snapshot (CPUs, RAM) at session start; optional `.perf.json` samples when "Sample during session" is on; Open profiler output link (future). |

**Log level:** Lines that look like PERF/jank/GC/ANR are still classified as level "performance" (purple) in the log and in the session list; the panel is the single place for all PERF ideas (Current + Trends + Session).

**Flutter/Dart memory logs:** Memory-related lines are classified as performance only when (1) the line has Flutter/Dart context (e.g. logcat `I/flutter`, `D/dart`, or `package:flutter`/`package:dart` in the line) and (2) the line contains a high-confidence phrase (`Memory: N`, memory pressure/usage/leak, old/new gen, retained N, leak detected, potential leak). This avoids false positives from generic words like "heap" or "memory" in other runtimes. The **Memory** group in the Current tab shows these lines. Heuristics remain best-effort; prefer structured sources (e.g. DevTools, VM service) when available.

---

## What plugins can I add?

You can add exactly these (turn on in Options → Integrations… (dedicated screen) or via Command Palette → Configure integrations): packages, buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker, crashlytics, performance, terminal, linuxLogs, externalLogs, security, database, http, browser. There are no other plugins; when we add one, it will appear in the Integrations screen.
