# Integrations Plan Folder Guide

This folder currently contains two parallel document styles:

- **Numbered implementation specs** (`00x_*`) - concise, execution-focused, and status-tracked.
- **Long-form design docs** (topic filenames) - deep background and architecture notes.

Use this guide to avoid jumping between similarly named files.

## Start Here

- Integration API and lifecycle: [INTEGRATION_API.md](../history/INTEGRATION_API.md)
- Primary index (status + current spec links): [001_integration-specs-index.md](001_integration-specs-index.md)
- Delivery order and effort ranking: [TASK_BREAKDOWN_AND_EASE.md](TASK_BREAKDOWN_AND_EASE.md)

## Canonical Specs (current implementation status)

| Adapter | Canonical spec |
|---------|----------------|
| externalLogs | [009_integration-spec-application-file-logs.md](009_integration-spec-application-file-logs.md) |
| http | [010_integration-spec-http-network.md](010_integration-spec-http-network.md) |
| database | [011_integration-spec-database-query-logs.md](011_integration-spec-database-query-logs.md) |
| browser | [012_integration-spec-browser-devtools.md](012_integration-spec-browser-devtools.md) |
| security | [013_integration-spec-security-audit-logs.md](013_integration-spec-security-audit-logs.md) |

## Supporting Docs

- Runbook: [010_runbook-missing-or-empty-logs.md](010_runbook-missing-or-empty-logs.md)
- Shared schema artifact: [drift-advisor-session.schema.json](drift-advisor-session.schema.json)
- Related integration plan: [SAROPA_LINTS_INTEGRATION.md](SAROPA_LINTS_INTEGRATION.md)

## Long-Form Design Docs (reference/background)

These are intentionally verbose and may include ideas not yet implemented.

- [application-file-logs.md](application-file-logs.md)
- [http-network.md](http-network.md)
- [database-query-logs.md](database-query-logs.md)
- [browser-devtools.md](browser-devtools.md)
- [security-audit-logs.md](security-audit-logs.md)
