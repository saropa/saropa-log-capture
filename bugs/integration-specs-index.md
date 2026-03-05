# Integration adapter specs

Implementation specs for log-capture integration adapters. Each adapter is opt-in via `saropaLogCapture.integrations.adapters`. Design docs for **planned** integrations live in [docs/integrations/](../docs/integrations/). Implemented adapters are marked **Done** and documented in the spec (or provider code); **Pending** rows are planned.

| Adapter id | Spec | Status |
|------------|------|--------|
| `packages` | *(implemented)* — see [src/modules/integrations/providers/package-lockfile.ts](../src/modules/integrations/providers/package-lockfile.ts) | Done |
| `buildCi` | [integration-spec-build-ci.md](integration-spec-build-ci.md) | Done |
| `git` | [integration-spec-git-source-code.md](integration-spec-git-source-code.md) | Done |
| `environment` | [integration-spec-environment-snapshot.md](integration-spec-environment-snapshot.md) | Done |
| `testResults` | [integration-spec-test-results.md](integration-spec-test-results.md) | Done |
| `coverage` | [integration-spec-code-coverage.md](integration-spec-code-coverage.md) | Done |
| `crashDumps` | [integration-spec-crash-dumps.md](integration-spec-crash-dumps.md) | Done |
| `windowsEvents` | [integration-spec-windows-event-log.md](integration-spec-windows-event-log.md) | Done |
| `docker` | [integration-spec-docker-containers.md](integration-spec-docker-containers.md) | Done |
| `database` | [integration-spec-database-query-logs.md](integration-spec-database-query-logs.md) | Done |
| `externalLogs` | [integration-spec-application-file-logs.md](integration-spec-application-file-logs.md) | Done |
| `performance` | [integration-spec-performance-profiling.md](integration-spec-performance-profiling.md) | Done |
| `http` | [integration-spec-http-network.md](integration-spec-http-network.md) | Done |
| `terminal` | [integration-spec-terminal-output.md](integration-spec-terminal-output.md) | Done |
| `browser` | [integration-spec-browser-devtools.md](integration-spec-browser-devtools.md) | Done |
| `linuxLogs` | [integration-spec-wsl-linux-logs.md](integration-spec-wsl-linux-logs.md) | Done |
| `security` | [integration-spec-security-audit-logs.md](integration-spec-security-audit-logs.md) | Done |

**API:** [docs/integrations/INTEGRATION_API.md](../docs/integrations/INTEGRATION_API.md) — provider contract, lifecycle, performance/UX, status bar.

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

You can add exactly these (turn on in Options → Integrations or via Command Palette → Configure integrations): packages, buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker, crashlytics, performance, terminal, linuxLogs, externalLogs, security, database, http, browser. There are no other plugins; when we add one, it will appear in Options.
