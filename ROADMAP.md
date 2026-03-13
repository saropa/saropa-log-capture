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

## 2. Status of plans (at a glance)

| Status | Items |
|--------|--------|
| **Partially implemented** | **Docker** ([007](bugs/007_plan-docker-inspect-and-until.md)): inspect/logs done; `includeInspect` sidecar and `--until` not. **Adapters** ([001](bugs/001_integration-specs-index.md)): database, externalLogs, http, browser, security — specs exist, full implementation not. |
| **Not implemented** | AI Explain Error, Noise Learning, Share Investigation; integration specs [009](bugs/009_integration-spec-application-file-logs.md) [010](bugs/010_integration-spec-http-network.md) [011](bugs/011_integration-spec-database-query-logs.md) [012](bugs/012_integration-spec-browser-devtools.md) [013](bugs/013_integration-spec-security-audit-logs.md) (externalLogs, http, database, browser, security). |

---

## 3. Planned features (Tier 7: Intelligence layer)

See [bugs/019_cohesion-plans-index.md](bugs/019_cohesion-plans-index.md) for cohesion/intelligence index.

| # | Feature | Description | Plan | Effort |
|---|---------|-------------|------|--------|
| 110 | AI Explain Error | Right-click → Explain with AI (VS Code Language Model API) | [023](bugs/023_plan-ai-explain-error.md) | 5-8 days |
| 112 | Noise Learning | Learn from user dismissals, suggest filters | [025](bugs/025_plan-noise-learning.md) | 10-14 days |
| 113 | Share Investigation | Generate shareable URL for investigation. *Depends on Investigation Mode.* | [026](bugs/026_plan-share-investigation.md) | 9-13 days |

### Implementation order

1. **AI Explain Error** [023](bugs/023_plan-ai-explain-error.md) (5-8 days) — Right-click → Explain with AI; uses Context Popover data.
2. **Noise Learning** [025](bugs/025_plan-noise-learning.md) (10-14 days) — Learn from dismissals, suggest exclusion rules.
3. **Share Investigation** [026](bugs/026_plan-share-investigation.md) (9-13 days) — Shareable URL/gist; depends on Investigation Mode.

---

## 4. Integration & adapter work (partial / not implemented)

| Area | What exists | What's missing | Plan |
|------|-------------|----------------|------|
| Build/CI | File + GitHub/Azure/GitLab API sources; SecretStorage tokens; async header + meta | — | Done ([004](bugs/history/20260313/004_plan-build-ci-api-sources.md)) |
| Docker | inspect (meta), logs with `--since` | `includeInspect` sidecar; `--until` on logs | [007](bugs/007_plan-docker-inspect-and-until.md) |
| Adapters: database, externalLogs, http, browser, security | Specs only | Full implementation | [001](bugs/001_integration-specs-index.md) · [009](bugs/009_integration-spec-application-file-logs.md) [010](bugs/010_integration-spec-http-network.md) [011](bugs/011_integration-spec-database-query-logs.md) [012](bugs/012_integration-spec-browser-devtools.md) [013](bugs/013_integration-spec-security-audit-logs.md) |

---

## 5. Enhancement opportunities

### Viewer / options (optional polish)

- Export button in Options → Actions; optional "Presets" → "Quick Filters" UI copy.

### Performance & scale

| Feature | Description |
|---------|-------------|
| Lazy load session list | Virtualize or paginate for 100+ sessions |
| Incremental index for search | Extend project indexer for "search in all logs" |

### Analytics & insights

| Feature | Description |
|---------|-------------|
| Error rate over time | Chart: errors/minute over session |
| Session comparison (3-way) | Compare three sessions |
| Export Insights summary | CSV/JSON of recurring errors + hot files |

---

## 6. Future ideas

| # | Idea | Description |
|---|------|-------------|
| 1 | Live collaboration | Share session; others see same log and scroll position |
| 2 | Regression hints | "This error pattern appeared after commit X" |
| 3 | Log diff from Git | Compare session to previous commit |
| 4 | Voice / TTS | Read selected lines or errors |
| 5 | Session replay | Replay log with simulated timing |
| 6 | Smart bookmarks | Auto-suggest at first error per run |
| 7 | Bidirectional sync | Reload/merge when log file is modified externally |

---

## 7. Known issues

| Issue | Location | Severity |
|-------|----------|----------|
| CSP `unsafe-inline` in viewer | viewer-content.ts | Medium |
| No explicit accessibility (a11y) | webview UI | Medium |
| Hardcoded Marketplace URL | about-content-loader.ts | Low |

---

*For changelog, see [CHANGELOG.md](CHANGELOG.md). For code standards, see [CONTRIBUTING.md](CONTRIBUTING.md).*
