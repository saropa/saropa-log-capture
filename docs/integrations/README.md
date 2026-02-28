# Log Capture Integration Ideas

**API:** All integrations plug into the **Integration API** — see [INTEGRATION_API.md](INTEGRATION_API.md) for the provider contract, lifecycle, and wiring. Use `getDefaultIntegrationRegistry().register(provider)` to add a provider; session lifecycle calls `getHeaderContributions` at start and `runOnSessionEnd` at end automatically.

This folder contains **full, detailed design documents** for integration points that would make Saropa Log Capture's debug logs more useful by correlating them with other data sources: system logs, applications, source code, databases, build systems, and more.

Each document is standalone and covers:

- **Problem & goal** — Why the integration matters
- **Data sources** — What external systems or logs are involved
- **Integration approach** — How it plugs into the extension (header, sidebar, markers, export)
- **User experience** — Settings, UI, and workflows
- **Implementation outline** — Components, APIs, and constraints
- **Configuration** — Settings and security/privacy considerations
- **Risks & alternatives** — Trade-offs and optional designs

The extension today already captures Debug Console (DAP) output with a **context header** (session metadata: date, project, debug adapter, launch config, VS Code/extension version, OS, git branch/commit, Node, etc.). These integrations extend that context or add correlated views.

| Document | Summary |
|----------|---------|
| [Windows Event Log](windows-event-log.md) | Correlate debug sessions with Windows Application/System/Security events by time range |
| [Git and Source Code](git-source-code.md) | Extended git context: blame at error lines, PR links, diff summary, tags |
| [Database Query Logs](database-query-logs.md) | Correlate SQL/query logs with debug output via request IDs or timestamps |
| [Application and File Logs](application-file-logs.md) | Tail external log files (app.log, IIS, nginx) alongside debug output |
| [Build and CI](build-ci.md) | Last build result, build ID, and link to pipeline run in session context |
| [Performance and Profiling](performance-profiling.md) | CPU/memory snapshots and process metrics correlated with log timeline |
| [HTTP and Network](http-network.md) | Capture or correlate HTTP requests with log lines (proxy, devtools) |
| [Terminal Output](terminal-output.md) | Integrate Integrated Terminal output in same session or side-by-side view |
| [Browser and DevTools](browser-devtools.md) | Web apps: correlate browser console with debug console via CDP or extension |
| [Docker and Containers](docker-containers.md) | Container logs, image digest, and docker inspect in session context |
| [WSL and Linux Logs](wsl-linux-logs.md) | dmesg, syslog when debugging WSL or Linux targets |
| [Crash Dumps](crash-dumps.md) | List and link minidumps or core dumps from the session time window |
| [Package and Lockfile](package-lockfile.md) | Lockfile hash and package versions in header for reproducibility |
| [Test Results](test-results.md) | Last test run (pass/fail, failed tests) linked to session |
| [Security and Audit Logs](security-audit-logs.md) | Auth events and audit trail correlation (e.g. Windows Security log) |
| [Code Coverage](code-coverage.md) | Link last coverage run (lcov/Cobertura) and open report from session |
| [Environment and Config Snapshot](environment-snapshot.md) | Env checksum and config file hashes for reproducibility |
