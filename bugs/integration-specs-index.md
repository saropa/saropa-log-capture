# Integration adapter specs

Implementation specs for log-capture integration adapters. Each adapter is opt-in via `saropaLogCapture.integrations.adapters`. Full design docs live in [docs/integrations/](../docs/integrations/). Implemented adapters are marked **Done**; rows below with **Pending** are planned.

| Adapter id | Spec | Status |
|------------|------|--------|
| `packages` | *(implemented)* — see [docs/integrations/package-lockfile.md](../docs/integrations/package-lockfile.md) | Done |
| `buildCi` | [integration-spec-build-ci.md](integration-spec-build-ci.md) | Done |
| `git` | [integration-spec-git-source-code.md](integration-spec-git-source-code.md) | Done |
| `environment` | [integration-spec-environment-snapshot.md](integration-spec-environment-snapshot.md) | Done |
| `testResults` | [integration-spec-test-results.md](integration-spec-test-results.md) | Done |
| `coverage` | [integration-spec-code-coverage.md](integration-spec-code-coverage.md) | Done |
| `crashDumps` | [integration-spec-crash-dumps.md](integration-spec-crash-dumps.md) | Done |
| `windowsEvents` | [integration-spec-windows-event-log.md](integration-spec-windows-event-log.md) | Done |
| `docker` | [integration-spec-docker-containers.md](integration-spec-docker-containers.md) | Done |
| `database` | [integration-spec-database-query-logs.md](integration-spec-database-query-logs.md) | Pending |
| `externalLogs` | [integration-spec-application-file-logs.md](integration-spec-application-file-logs.md) | Pending |
| `performance` | [integration-spec-performance-profiling.md](integration-spec-performance-profiling.md) | Pending |
| `http` | [integration-spec-http-network.md](integration-spec-http-network.md) | Pending |
| `terminal` | [integration-spec-terminal-output.md](integration-spec-terminal-output.md) | Pending |
| `browser` | [integration-spec-browser-devtools.md](integration-spec-browser-devtools.md) | Pending |
| `linuxLogs` | [integration-spec-wsl-linux-logs.md](integration-spec-wsl-linux-logs.md) | Pending |
| `security` | [integration-spec-security-audit-logs.md](integration-spec-security-audit-logs.md) | Pending |

**API:** [docs/integrations/INTEGRATION_API.md](../docs/integrations/INTEGRATION_API.md) — provider contract, lifecycle, performance/UX, status bar.
