# Log Capture Integration Ideas

**API:** All integrations plug into the **Integration API** — see [INTEGRATION_API.md](INTEGRATION_API.md) for the provider contract, lifecycle, and wiring. Use `getDefaultIntegrationRegistry().register(provider)` to add a provider; session lifecycle calls `getHeaderContributions` at start and `runOnSessionEnd` at end automatically.

This folder contains **full, detailed design documents** for **planned** integration points (not yet implemented). Implemented integrations are documented elsewhere:

- **Options → Integrations** — Enable/disable and see which adapters are available (packages, buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker, performance, terminal, linuxLogs, crashlytics).
- **Provider code** — `src/modules/integrations/providers/` (each provider has JSDoc describing behavior and config).
- **Implementation specs** — [bugs/integration-specs-index.md](../../bugs/integration-specs-index.md) and the linked `integration-spec-*.md` files for each adapter (except **packages**, which has no bugs spec; see `package-lockfile.ts`).

Each design document below is standalone and covers problem & goal, data sources, integration approach, user experience, implementation outline, configuration, and risks. The docs below describe **planned** integrations not yet fully implemented.

| Document | Summary |
|----------|---------|
| [Database Query Logs](database-query-logs.md) | Correlate SQL/query logs with debug output via request IDs or timestamps |
| [Application and File Logs](application-file-logs.md) | Tail external log files (app.log, IIS, nginx) alongside debug output |
| [HTTP and Network](http-network.md) | Capture or correlate HTTP requests with log lines (proxy, devtools) |
| [Browser and DevTools](browser-devtools.md) | Web apps: correlate browser console with debug console via CDP or extension |
| [Security and Audit Logs](security-audit-logs.md) | Auth events and audit trail correlation (e.g. Windows Security log) |
