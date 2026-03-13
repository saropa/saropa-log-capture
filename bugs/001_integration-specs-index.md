# Integration adapter specs

Implementation specs for log-capture integration adapters. Each adapter is opt-in via `saropaLogCapture.integrations.adapters`. Design docs for **planned** integrations live in [docs/integrations/](../docs/integrations/). Implemented adapters are marked **Done** and documented in the spec (or provider code); **Pending** rows are planned.

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
| `database` | [011_integration-spec-database-query-logs.md](011_integration-spec-database-query-logs.md) | Partial |
| `externalLogs` | [009_integration-spec-application-file-logs.md](009_integration-spec-application-file-logs.md) | Partial |
| `performance` | *(implemented)* — spec moved to [history/](history/) | Done |
| `http` | [010_integration-spec-http-network.md](010_integration-spec-http-network.md) | Partial |
| `terminal` | *(implemented)* — spec moved to [history/](history/) | Done |
| `browser` | [012_integration-spec-browser-devtools.md](012_integration-spec-browser-devtools.md) | Partial |
| `linuxLogs` | *(implemented)* — spec moved to [history/](history/) | Done |
| `security` | [013_integration-spec-security-audit-logs.md](013_integration-spec-security-audit-logs.md) | Partial |

**API:** [docs/history/INTEGRATION_API.md](../docs/history/INTEGRATION_API.md) — provider contract, lifecycle, performance/UX, status bar.

---

## Performance (PERF): one place (the Performance panel)

All performance-related features live in the **Performance panel** (graph icon). It is OK to flag HOT/flame/slow items in the log list (e.g. purple perf count); the full story is in the panel.

| Tab / feature | What it is | Where you see it |
|---------------|------------|------------------|
| **Current** | We scan the **current log** for PERF/jank/GC/timeout and group them. | Performance panel → **Current** tab. Click a row to jump to that line. |
| **Trends** | Cross-session aggregated durations and trend (improving/degrading/stable). | Performance panel → **Trends** tab. Table + chart. |
| **Session** | System snapshot, session samples, and profiler output. | Performance panel → **Session** tab. When the Performance adapter is enabled: snapshot (CPUs, RAM) at session start; optional `.perf.json` samples when "Sample during session" is on; Open profiler output link (future). |

**Log level:** Lines that look like PERF/jank/GC/ANR are still classified as level "performance" (purple) in the log and in the session list; the panel is the single place for all PERF ideas (Current + Trends + Session).

---

## What plugins can I add?

You can add exactly these (turn on in Options → Integrations… (dedicated screen) or via Command Palette → Configure integrations): packages, buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker, crashlytics, performance, terminal, linuxLogs, externalLogs, security, database, http, browser. There are no other plugins; when we add one, it will appear in the Integrations screen.
