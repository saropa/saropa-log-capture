# Log Capture Integration Ideas

**API:** All integrations plug into the **Integration API** — see [INTEGRATION_API.md](INTEGRATION_API.md) for the provider contract, lifecycle, and wiring. Use `getDefaultIntegrationRegistry().register(provider)` to add a provider; session lifecycle calls `getHeaderContributions` at start and `runOnSessionEnd` at end automatically.

This folder contains **full, detailed design documents** for **planned** integration points (not yet implemented). Implemented integrations are documented elsewhere:

- **Options → Integrations** — Enable/disable and see which adapters are available (packages, buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker, crashlytics).
- **Provider code** — `src/modules/integrations/providers/` (each provider has JSDoc describing behavior and config).
- **Implementation specs** — [bugs/integration-specs-index.md](../../bugs/integration-specs-index.md) and the linked `integration-spec-*.md` files for each adapter (except **packages**, which has no bugs spec; see `package-lockfile.ts`).

Each design document below is standalone and covers:

- **Problem & goal** — Why the integration matters
- **Data sources** — What external systems or logs are involved
- **Integration approach** — How it plugs into the extension (header, sidebar, markers, export)
- **User experience** — Settings, UI, and workflows
- **Implementation outline** — Components, APIs, and constraints
- **Configuration** — Settings and security/privacy considerations
- **Risks & alternatives** — Trade-offs and optional designs

The extension already captures Debug Console (DAP) output with a **context header** (session metadata: date, project, debug adapter, launch config, VS Code/extension version, OS, git branch/commit, Node, etc.). Implemented integrations extend that context; the docs below describe **planned** ones.

| Document | Summary |
|----------|---------|
| [Database Query Logs](database-query-logs.md) | Correlate SQL/query logs with debug output via request IDs or timestamps |
| [Application and File Logs](application-file-logs.md) | Tail external log files (app.log, IIS, nginx) alongside debug output |
| [Performance and Profiling](performance-profiling.md) | CPU/memory snapshots and process metrics correlated with log timeline |
| [HTTP and Network](http-network.md) | Capture or correlate HTTP requests with log lines (proxy, devtools) |
| [Terminal Output](terminal-output.md) | Integrate Integrated Terminal output in same session or side-by-side view |
| [Browser and DevTools](browser-devtools.md) | Web apps: correlate browser console with debug console via CDP or extension |
| [WSL and Linux Logs](wsl-linux-logs.md) | dmesg, syslog when debugging WSL or Linux targets |
| [Security and Audit Logs](security-audit-logs.md) | Auth events and audit trail correlation (e.g. Windows Security log) |
